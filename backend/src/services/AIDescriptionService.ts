import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class AIDescriptionService {
    private static openai: OpenAI | null = null;

    private static initialize() {
        if (!this.openai) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                logger.warn('OPENAI_API_KEY not configured for AI descriptions.');
                return false;
            }
            this.openai = new OpenAI({ apiKey });
            logger.info('OpenAI initialized for product descriptions');
        }
        return true;
    }

    /**
     * Genera tutte le descrizioni per un prodotto:
     * - descrizioneLunga: descrizione completa HTML SEO-optimized
     * - descrizioneBrave: sintesi 150-200 caratteri
     * - testoPersonalizzato: testo promozionale accattivante
     */
    static async generateAllDescriptions(
        productName: string,
        brand: string | null,
        category: string | null,
        specs: any,
        icecatDescription?: string | null,
        price?: number | null
    ): Promise<{ descrizioneLunga: string, descrizioneBrave: string, testoPersonalizzato: string } | null> {
        if (!this.initialize() || !this.openai) return null;

        try {
            const specsText = Object.entries(specs)
                .filter(([_, value]) => value)
                .slice(0, 15) // Limita a 15 specifiche per non esagerare
                .map(([key, value]) => `- ${key}: ${value}`)
                .join('\n');

            const isComplexProduct = category?.toLowerCase().includes('notebook') ||
                category?.toLowerCase().includes('desktop') ||
                category?.toLowerCase().includes('monitor') ||
                (price && price > 300);

            const wordCount = isComplexProduct ? '250-350' : '120-180';

            const prompt = `Sei un copywriter esperto per e-commerce tecnologico. Genera contenuti di vendita per questo prodotto.

=== PRODOTTO ===
Nome: ${productName}
Marca: ${brand || 'N/A'}
Categoria: ${category || 'N/A'}
Prezzo: ${price ? `€${price}` : 'N/A'}

SPECIFICHE:
${specsText || 'Non disponibili'}

${icecatDescription ? `INFO AGGIUNTIVE: ${icecatDescription.substring(0, 600)}` : ''}

=== GENERA 3 TESTI ===

### 1. DESCRIZIONE LUNGA (${wordCount} parole)
Struttura HTML:
<p><strong>HOOK:</strong> Inizia con il beneficio principale. Parla al cliente ("Tu", "Tuo"). Cosa risolve questo prodotto?</p>

<h3>Caratteristiche Principali</h3>
<ul>
<li><strong>Nome spec:</strong> Perché è importante per l'utente</li>
... (3-5 punti)
</ul>

<h3>Perfetto Per</h3>
<p>Chi dovrebbe comprarlo e perché. Casi d'uso concreti.</p>

<p><strong>Garanzia ${brand || 'del produttore'}:</strong> Call to action finale.</p>

### 2. DESCRIZIONE BREVE (max 180 caratteri)
Una frase che cattura l'essenza: marca + categoria + 1-2 specifiche chiave + beneficio.

### 3. TESTO PERSONALIZZATO (max 200 caratteri)
Testo promozionale accattivante e persuasivo. Deve creare urgenza e desiderio.

=== FORMATO OUTPUT ===
DESCRIZIONE_LUNGA:
[HTML qui]
---BREAK---
DESCRIZIONE_BREVE:
[testo qui]
---BREAK---
TESTO_PERSONALIZZATO:
[testo qui]`;

            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-4o-mini",
                temperature: 0.7,
                max_tokens: 1500
            });

            const text = completion.choices[0].message.content?.trim() || '';

            // Parse
            const parts = text.split('---BREAK---');
            if (parts.length < 3) {
                logger.warn('AI response format invalid, attempting recovery...');
                // Tentativo di recupero
                return {
                    descrizioneLunga: text.length > 200 ? text : `<p>${productName} - ${brand || ''} ${category || ''}</p>`,
                    descrizioneBrave: `${brand || ''} ${productName}`.substring(0, 180),
                    testoPersonalizzato: `Scopri ${productName} di ${brand || 'qualità'}.`.substring(0, 200)
                };
            }

            let descrizioneLunga = parts[0].replace(/DESCRIZIONE_LUNGA:\s*/i, '').trim();
            let descrizioneBrave = parts[1].replace(/DESCRIZIONE_BREVE:\s*/i, '').trim();
            let testoPersonalizzato = parts[2].replace(/TESTO_PERSONALIZZATO:\s*/i, '').trim();

            // Limiti di lunghezza
            if (descrizioneBrave.length > 200) {
                descrizioneBrave = descrizioneBrave.substring(0, 197) + '...';
            }
            if (testoPersonalizzato.length > 200) {
                testoPersonalizzato = testoPersonalizzato.substring(0, 197) + '...';
            }

            return { descrizioneLunga, descrizioneBrave, testoPersonalizzato };

        } catch (error: any) {
            logger.error(`Error generating AI descriptions: ${error.message}`);
            return null;
        }
    }

    /**
     * Verifica se una descrizione necessita di miglioramento AI
     */
    static needsAIDescription(description: string | null): boolean {
        if (!description) return true;
        if (description.length < 100) return true;

        const genericPhrases = ['la soluzione ideale', 'progettato per integrarsi', 'questo prodotto'];
        const lowerDesc = description.toLowerCase();
        return genericPhrases.some(phrase => lowerDesc.includes(phrase));
    }

    /**
     * Genera un titolo SEO ottimizzato per e-commerce
     */
    static async generateOptimizedTitleAI(
        brand: string,
        model: string,
        category: string,
        rawName: string
    ): Promise<string | null> {
        if (!this.initialize() || !this.openai) return null;

        const prompt = `Sei un esperto SEO per e-commerce. Genera un titolo prodotto PERFETTO (max 100 caratteri).
Input:
Marca: ${brand}
Modello/Codice: ${model}
Categoria: ${category}
Nome Originale: ${rawName}

Istruzioni:
1. Formato: [Marca] [Modello Reale] [Categoria] - [Spec Chiave 1], [Spec Chiave 2]
2. Se il modello fornito è un codice brutto (es. 07.3940) e riesci a dedurre il nome commerciale dal "Nome Originale", USA IL NOME COMMERCIALE.
3. Se non riesci a dedurre nulla, usa il codice ma rendilo leggibile.
4. Includi specifiche tecniche se presenti nel nome originale (CPU, RAM, SSD).
5. Output SOLO il titolo finale.`;

        try {
            const completion = await this.openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "gpt-4o-mini",
                max_tokens: 100,
                temperature: 0.3
            });

            return completion.choices[0].message.content?.trim() || null;
        } catch (error: any) {
            logger.error(`Error generating AI title: ${error.message}`);
            return null;
        }
    }
}
