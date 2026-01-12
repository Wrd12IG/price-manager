/**
 * AITitleService
 * 
 * Genera titoli professionali per prodotti usando Google Gemini AI
 * quando i dati Icecat non sono disponibili o sono di bassa qualità.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

export class AITitleService {
    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    /**
     * Inizializza il client Gemini
     */
    private static initialize() {
        if (!this.genAI) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                logger.warn('GEMINI_API_KEY not configured. AI title generation disabled.');
                return false;
            }
            // Use the stable API (default) and the latest Gemini model
            this.genAI = new GoogleGenerativeAI(apiKey);
            // gemini-flash-latest is the current stable flash model
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
            logger.info('Google Gemini AI (gemini-flash-latest) initialized for title generation');
        }
        return true;
    }

    /**
     * Genera un titolo professionale per un prodotto usando AI
     * 
     * @param ean - Codice EAN del prodotto
     * @param brand - Marca del prodotto
     * @param category - Categoria del prodotto
     * @param currentTitle - Titolo attuale (opzionale, per migliorarlo)
     * @returns Titolo generato dall'AI o fallback
     */
    static async generateProductTitle(
        ean: string,
        brand?: string,
        category?: string,
        currentTitle?: string,
        description?: string,
        specs?: any
    ): Promise<string> {

        // Verifica se l'AI è disponibile
        if (!this.initialize()) {
            return this.generateFallbackTitle(ean, brand, category);
        }

        try {
            let featuresContext = '';
            if (specs) {
                // Se specs è una stringa JSON
                const specsObj = typeof specs === 'string' ? JSON.parse(specs) : specs;

                // Formatta le specifiche chiave
                const keySpecs: string[] = [];
                // Cerca specifiche comuni
                const commonKeys = ['cpu', 'processor', 'ram', 'memory', 'storage', 'hdd', 'ssd', 'display', 'screen', 'monitor', 'vga', 'gpu', 'os', 'system'];

                // Estrai valori
                if (Array.isArray(specsObj)) {
                    // Formato array {name: '...', value: '...'}
                    specsObj.forEach((s: any) => {
                        if (commonKeys.some(k => s.name?.toLowerCase().includes(k))) {
                            keySpecs.push(`${s.name}: ${s.value}`);
                        }
                    });
                } else {
                    // Formato oggetto key-value
                    Object.entries(specsObj).forEach(([k, v]) => {
                        if (commonKeys.some(key => k.toLowerCase().includes(key))) {
                            keySpecs.push(`${k}: ${v}`);
                        }
                    });
                }

                if (keySpecs.length > 0) {
                    featuresContext = `\nSpecifiche Tecniche:\n${keySpecs.join('\n')}`;
                }
            }

            const prompt = `Sei un esperto di e-commerce e SEO. Genera un titolo professionale per un prodotto con queste informazioni:

EAN/GTIN: ${ean}
Marca: ${brand || 'Non specificata'}
Categoria: ${category || 'Non specificata'}
${currentTitle ? `Titolo attuale (da migliorare): ${currentTitle}` : ''}
${description ? `Descrizione: ${description.substring(0, 500)}...` : ''}${featuresContext}

REQUISITI OBBLIGATORI:
1. Massimo 75 caratteri (ideale 60-70)
2. In lingua ITALIANA
3. NON includere il codice EAN nel titolo
4. Stile professionale per e-commerce e SEO friendly
5. Includi specifiche tecniche chiave se disponibili (es. capacità, dimensioni, modello)
6. Formato preferito: "Marca Modello - Specifica1 - Specifica2"
7. NON usare parole promozionali (es. "offerta", "novità", "migliore")

ESEMPI DI TITOLI PROFESSIONALI:
- "HP Enterprise Cartuccia Dati LTO-9 - 18TB Nativo / 45TB Compressi"
- "Lenovo ThinkPad E14 - 14\" FHD - Intel i5 - 16GB RAM - 512GB SSD"
- "Samsung Monitor Curvo 27\" - WQHD 2560x1440 - 144Hz - HDR"

Rispondi SOLO con il titolo generato, senza spiegazioni o commenti aggiuntivi.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let generatedTitle = response.text().trim();

            // Rimuovi eventuali virgolette o caratteri extra
            generatedTitle = generatedTitle.replace(/^["']|["']$/g, '').trim();

            // Verifica che il titolo sia valido
            if (generatedTitle.length > 0 && generatedTitle.length <= 100) {
                logger.info(`AI generated title for EAN ${ean}: "${generatedTitle}"`);
                return generatedTitle;
            } else {
                logger.warn(`AI generated invalid title for EAN ${ean}, using fallback`);
                return this.generateFallbackTitle(ean, brand, category);
            }

        } catch (error: any) {
            logger.error(`Error generating AI title for EAN ${ean}: ${error.message}`);
            return this.generateFallbackTitle(ean, brand, category);
        }
    }

    /**
     * Genera un titolo fallback quando l'AI non è disponibile
     */
    private static generateFallbackTitle(
        ean: string,
        brand?: string,
        category?: string
    ): string {
        const parts = [];

        if (brand) parts.push(brand);
        if (category && category !== 'Default') {
            // Pulisci la categoria da sigle generiche
            const cleanCategory = category
                .replace(/^[A-Z]{2,4}\s+/i, '') // Rimuovi sigle tipo "HP ", "NB "
                .trim();
            if (cleanCategory) parts.push(cleanCategory);
        }

        if (parts.length === 0) {
            return 'Prodotto Professionale';
        }

        return parts.join(' - ');
    }

    /**
     * Verifica se un titolo è di bassa qualità e necessita miglioramento
     */
    static needsImprovement(title: string): boolean {
        // Titolo è un codice prodotto
        if (/^[0-9\.\-]+$/.test(title)) return true;

        // Titolo troppo corto
        if (title.length < 15) return true;

        // Titolo generico
        const genericTerms = ['prodotto', 'articolo', 'item', 'product', 'opzioni'];
        const lowerTitle = title.toLowerCase();
        if (genericTerms.some(term => lowerTitle.includes(term))) return true;

        // Titolo contiene solo marca e categoria generica
        if (/^[A-Z\s]+$/i.test(title) && title.split(' ').length <= 3) return true;

        return false;
    }

    /**
     * Migliora un batch di titoli in modo efficiente
     * Utile per processare molti prodotti in una volta
     */
    static async improveTitlesBatch(
        products: Array<{ ean: string; brand?: string; category?: string; currentTitle: string }>
    ): Promise<Map<string, string>> {
        const results = new Map<string, string>();

        for (const product of products) {
            if (this.needsImprovement(product.currentTitle)) {
                const newTitle = await this.generateProductTitle(
                    product.ean,
                    product.brand,
                    product.category,
                    product.currentTitle
                );
                results.set(product.ean, newTitle);

                // Rate limiting: aspetta 500ms tra una richiesta e l'altra
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return results;
    }
}
