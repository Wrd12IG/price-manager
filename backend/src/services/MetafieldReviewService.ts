// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * #15 — AI Review dei Metafields Generati
 * Fa passare i metafields generati da AI attraverso un secondo check con Gemini
 * (critic model) per verificare coerenza, qualità e assenza di allucinazioni.
 * AI vs AI per maggiore affidabilità.
 */
export class MetafieldReviewService {

    private static async getApiKey(utenteId: number): Promise<string | null> {
        const personal = await prisma.configurazioneSistema.findFirst({
            where: { utenteId, chiave: 'GEMINI_API_KEY' }
        });
        if (personal?.valore) return personal.valore;
        const global = await prisma.configurazioneSistema.findFirst({
            where: { utenteId: null, chiave: 'GEMINI_API_KEY' }
        });
        return global?.valore || process.env.GEMINI_API_KEY || null;
    }

    /**
     * Review completa di un singolo outputShopify.
     * Invia metafields + dati prodotto reali a Gemini con ruolo "critic".
     * Restituisce un JSON con: score, approved, issues[], suggestions[].
     */
    static async reviewOutputProduct(
        utenteId: number,
        outputId: number
    ): Promise<{
        approved: boolean;
        score: number;
        issues: string[];
        suggestions: string[];
        rawFeedback: string;
    }> {
        const apiKey = await this.getApiKey(utenteId);
        if (!apiKey) throw new Error('Gemini API key non configurata');

        const output = await prisma.outputShopify.findFirst({
            where: { id: outputId, utenteId },
            include: {
                masterFile: {
                    include: {
                        datiIcecat: true,
                        marchio: { select: { nome: true } },
                        categoria: { select: { nome: true } }
                    }
                }
            }
        });
        if (!output) throw new Error('Prodotto non trovato o non autorizzato');

        const mf = output.masterFile;
        const icecat = mf?.datiIcecat;

        // Costruisci fonte-verità (dati reali, non generati da AI)
        let groundTruth = `TITOLO REALE: ${mf?.nomeProdotto || 'N/D'}
MARCA: ${mf?.marchio?.nome || 'N/D'}
CATEGORIA: ${mf?.categoria?.nome || 'N/D'}
EAN/GTIN: ${mf?.eanGtin || 'N/D'}
PART NUMBER: ${mf?.partNumber || 'N/D'}
PREZZO ACQUISTO: €${mf?.prezzoAcquistoMigliore?.toFixed(2) || 'N/D'}`;

        if (icecat?.descrizioneBrave) groundTruth += `\nDESCRIZIONE ICECAT: ${icecat.descrizioneBrave}`;
        if (icecat?.specificheTecnicheJson) {
            try {
                const specs = JSON.parse(icecat.specificheTecnicheJson);
                const specStr = Array.isArray(specs)
                    ? specs.slice(0, 20).map((s: any) => `${s.name || s.Feature?.Name?.Value}: ${s.value || s.PresentationValue}`).join('\n')
                    : JSON.stringify(specs).substring(0, 1000);
                groundTruth += `\nSPECIFICHE ICECAT:\n${specStr}`;
            } catch { }
        }

        // Metafields generati da AI (da revisionare)
        let metafieldsText = 'N/D';
        if (output.metafieldsJson) {
            try {
                const meta = JSON.parse(output.metafieldsJson);
                metafieldsText = Object.entries(meta)
                    .map(([k, v]) => `${k}: ${String(v).substring(0, 300)}`)
                    .join('\n');
            } catch { metafieldsText = output.metafieldsJson.substring(0, 2000); }
        }

        const prompt = `Sei un quality reviewer di schede prodotto e-commerce. Il tuo compito è verificare la qualità e accuratezza dei metafields generati da un AI generativo, confrontandoli con i dati reali verificabili del prodotto.

=== DATI REALI DEL PRODOTTO (fonte di verità) ===
${groundTruth}

=== METAFIELDS GENERATI DA AI (da revisionare) ===
${metafieldsText}

=== TITOLO E-COMMERCE GENERATO ===
${output.title || 'N/D'}

=== DESCRIZIONE HTML GENERATA ===
${(output.bodyHtml || '').replace(/<[^>]+>/g, ' ').substring(0, 500)}

=== IL TUO COMPITO ===
Analizza i metafields generati e rispondi SOLO con un JSON valido (senza markdown) nel seguente formato:
{
  "score": <numero 1-10, qualità generale>,
  "approved": <true se score >= 7 e nessun issue critico, false altrimenti>,
  "issues": [<lista di problemi concreti trovati, es. "RAM indicata come 32GB ma non confermata da dati Icecat">],
  "suggestions": [<lista di miglioramenti concreti>],
  "summary": "<brevissimo riassunto in italiano della tua valutazione>"
}

CRITERI DI VALUTAZIONE:
- Coerenza con i dati reali (EAN, PartNumber, marca, specifiche tecniche)
- Presenza di "allucinazioni" (dati non verificabili o contraddittori con la fonte)
- Qualità SEO di titolo e descrizione
- Completezza dei metafields richiesti
- Presenza di claims non supportati

OUTPUT (solo JSON, nessun testo aggiuntivo):`;

        const genAI = new GoogleGenerativeAI(apiKey);
        // Usa flash per velocità - è un compito di revisione
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        let reviewResult: any = { score: 5, approved: false, issues: [], suggestions: [], summary: 'Review non completata' };

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            // Estrai JSON anche se wrapped in ```json```
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                reviewResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Risposta non in formato JSON');
            }
        } catch (err: any) {
            logger.error(`❌ AI Review parse error per output ${outputId}: ${err.message}`);
            reviewResult = {
                score: 5,
                approved: false,
                issues: [`Errore durante la review: ${err.message}`],
                suggestions: [],
                summary: 'Review fallita per errore tecnico'
            };
        }

        const approved = reviewResult.approved === true || (reviewResult.score >= 7 && (reviewResult.issues?.length || 0) === 0);
        const status = approved ? 'approved' : (reviewResult.score <= 3 ? 'flagged' : 'needs_work');

        // Salva risultato sul record
        await prisma.outputShopify.update({
            where: { id: outputId },
            data: {
                aiReviewStatus: status,
                aiReviewJson: JSON.stringify({
                    ...reviewResult,
                    approved,
                    reviewedAt: new Date().toISOString()
                })
            }
        });

        logger.info(`✅ AI Review completata per output ${outputId}: score=${reviewResult.score}, status=${status}`);

        return {
            approved,
            score: reviewResult.score || 5,
            issues: reviewResult.issues || [],
            suggestions: reviewResult.suggestions || [],
            rawFeedback: reviewResult.summary || ''
        };
    }

    /**
     * Esegue la review in batch su tutti i prodotti non ancora revisionati.
     * Processa max `batchSize` prodotti per evitare timeout.
     */
    static async reviewBatch(
        utenteId: number,
        batchSize: number = 10
    ): Promise<{ processed: number; approved: number; flagged: number; errors: number }> {
        const pending = await prisma.outputShopify.findMany({
            where: {
                utenteId,
                isAiEnriched: true,
                metafieldsJson: { not: null },
                aiReviewStatus: null   // non ancora revisionati
            },
            select: { id: true },
            take: batchSize
        });

        let processed = 0, approved = 0, flagged = 0, errors = 0;

        for (const { id } of pending) {
            try {
                const result = await this.reviewOutputProduct(utenteId, id);
                processed++;
                if (result.approved) approved++;
                else flagged++;
                // Piccola pausa per rispettare rate limits Gemini
                await new Promise(r => setTimeout(r, 800));
            } catch (err: any) {
                errors++;
                logger.error(`❌ AI Review batch error per output ${id}: ${err.message}`);
                await prisma.outputShopify.update({
                    where: { id },
                    data: { aiReviewStatus: 'error', aiReviewJson: JSON.stringify({ error: err.message }) }
                });
            }
        }

        return { processed, approved, flagged, errors };
    }
}
