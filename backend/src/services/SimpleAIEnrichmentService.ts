// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Servizio per l'arricchimento dati tramite AI (senza web scraping)
 * 
 * Questo servizio genera dati di arricchimento usando solo le informazioni
 * già disponibili nel database (EAN, nome, marchio, categoria)
 */

interface AIEnrichedData {
    descrizioneBrave: string;
    descrizioneLunga: string;
    specificheTecniche: any;
    bulletPoints: string[];
    caratteristichePrincipali: any;
}

export class SimpleAIEnrichmentService {
    private static genAI: GoogleGenerativeAI | null = null;

    /**
     * Inizializza il client Google AI
     */
    private static async initializeAI(): Promise<void> {
        if (this.genAI) return;

        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('GOOGLE_AI_API_KEY non configurata');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * Genera dati di arricchimento usando AI basandosi sulle info disponibili
     */
    private static async generateEnrichmentData(
        ean: string,
        nomeProdotto: string | null,
        marchio: string | null,
        categoria: string | null
    ): Promise<AIEnrichedData> {
        await this.initializeAI();

        if (!this.genAI) {
            throw new Error('AI non inizializzata');
        }

        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Sei un esperto di prodotti tecnologici. Stai generando dati per un e-commerce.

EAN: ${ean}
Nome Prodotto: ${nomeProdotto || 'Non disponibile'}
Marchio: ${marchio || 'Non disponibile'}
Categoria: ${categoria || 'Non disponibile'}

Genera un oggetto JSON con le seguenti informazioni (senza markdown, senza backticks):
{
  "descrizioneBrave": "Descrizione breve e accattivante del prodotto (max 160 caratteri). Basa il testo SOLO sulle informazioni del titolo.",
  "descrizioneLunga": "Descrizione base del prodotto (1-2 paragrafi). Non parlare di componenti che non sono menzionati nel titolo. Esalta semplicemente il brand se conosciuto e la sua categoria generica.",
  "specificheTecniche": {},
  "bulletPoints": [
    "Punto di forza generico per macchine di questo tipo",
    "Punto di forza generico tratto dal titolo"
  ],
  "caratteristichePrincipali": {}
}

IMPORTANTE E TASSATIVO: 
- Restituisci SOLO il JSON nudo, senza markdown (\`\`\`json) e senza backticks.
- È ASSOLUTAMENTE VIETATO inventare specifiche tecniche numeriche o modelli (es. Processore, RAM, Storage, Scheda Grafica, Dimensioni, ecc.) se non sono ESPLICITAMENTE e CHIARAMENTE scritte alla lettera nel Nome Prodotto (Titolo).
- Piuttosto che inventare o "dedurre" una specifica tecnica o una porta USB, LASCIA L'OGGETTO "specificheTecniche" VUOTO o valorizza i campi a null/stringa vuota. Le finte specifiche causano resi.
- Basa il testo descrittivo in modo generico sulla categoria e sul marchio.`;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            logger.info(`📝 Risposta AI ricevuta (primi 200 caratteri): ${text.substring(0, 200)}`);

            // Pulisci la risposta da eventuali markdown
            let cleanedText = text.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
            }

            const data = JSON.parse(cleanedText);

            return {
                descrizioneBrave: data.descrizioneBrave || '',
                descrizioneLunga: data.descrizioneLunga || '',
                specificheTecniche: data.specificheTecniche || {},
                bulletPoints: data.bulletPoints || [],
                caratteristichePrincipali: data.caratteristichePrincipali || {}
            };
        } catch (error: any) {
            logger.error('❌ Errore generazione dati con AI:', error.message);
            logger.error('Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * Arricchisce un singolo prodotto usando AI
     */
    static async enrichSingleProduct(masterFileProductId: number): Promise<boolean> {
        try {
            // Recupera il prodotto dal Master File
            const product = await prisma.masterFile.findUnique({
                where: { id: masterFileProductId },
                include: {
                    marchio: { select: { nome: true } },
                    categoria: { select: { nome: true } },
                    datiIcecat: true
                }
            });

            if (!product) {
                logger.warn(`⚠️ Prodotto ${masterFileProductId} non trovato`);
                return false;
            }

            // Se ha già dati Icecat, salta
            if (product.datiIcecat) {
                logger.info(`⏭️ Prodotto ${product.eanGtin} già arricchito`);
                return false;
            }

            logger.info(`🤖 Generazione dati AI per: ${product.eanGtin} - ${product.nomeProdotto || 'N/D'}`);

            // Genera dati con AI
            const enrichedData = await this.generateEnrichmentData(
                product.eanGtin,
                product.nomeProdotto,
                product.marchio?.nome || null,
                product.categoria?.nome || null
            );

            // Salva i dati arricchiti nel database
            await prisma.datiIcecat.create({
                data: {
                    masterFileId: product.id,
                    eanGtin: product.eanGtin,
                    descrizioneBrave: enrichedData.descrizioneBrave,
                    descrizioneLunga: enrichedData.descrizioneLunga,
                    specificheTecnicheJson: JSON.stringify(enrichedData.specificheTecniche),
                    urlImmaginiJson: JSON.stringify([]), // Nessuna immagine disponibile
                    bulletPointsJson: JSON.stringify(enrichedData.bulletPoints),
                    documentiJson: JSON.stringify([]),
                    linguaOriginale: 'it',
                    dataScaricamento: new Date()
                }
            });

            logger.info(`✅ Prodotto ${product.eanGtin} arricchito con successo tramite AI`);
            return true;

        } catch (error: any) {
            logger.error(`❌ Errore arricchimento prodotto ${masterFileProductId}:`, error.message);
            return false;
        }
    }

    /**
     * Arricchisce tutti i prodotti del Master File che non hanno dati Icecat
     */
    static async enrichMissingProducts(limit: number = 50): Promise<{
        total: number;
        enriched: number;
        errors: number;
    }> {
        try {
            logger.info('🚀 Inizio arricchimento prodotti con AI...');

            // Trova prodotti senza dati Icecat
            const productsWithoutIcecat = await prisma.masterFile.findMany({
                where: {
                    datiIcecat: null
                },
                take: limit,
                select: {
                    id: true,
                    eanGtin: true,
                    nomeProdotto: true
                }
            });

            logger.info(`📦 Trovati ${productsWithoutIcecat.length} prodotti da arricchire`);

            let enriched = 0;
            let errors = 0;

            for (const product of productsWithoutIcecat) {
                try {
                    const success = await this.enrichSingleProduct(product.id);
                    if (success) {
                        enriched++;
                    }

                    // Pausa tra le richieste per evitare rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error: any) {
                    logger.error(`❌ Errore arricchimento ${product.eanGtin}:`, error.message);
                    errors++;
                }
            }

            logger.info(`✅ Arricchimento completato: ${enriched} successi, ${errors} errori`);

            return {
                total: productsWithoutIcecat.length,
                enriched,
                errors
            };

        } catch (error: any) {
            logger.error('❌ Errore durante l\'arricchimento:', error.message);
            throw error;
        }
    }

    /**
     * Ottiene statistiche sull'arricchimento
     */
    static async getEnrichmentStats(): Promise<{
        totalProducts: number;
        withIcecat: number;
        missing: number;
    }> {
        const totalProducts = await prisma.masterFile.count();
        const withIcecat = await prisma.masterFile.count({
            where: {
                datiIcecat: {
                    isNot: null
                }
            }
        });

        return {
            totalProducts,
            withIcecat,
            missing: totalProducts - withIcecat
        };
    }
}
