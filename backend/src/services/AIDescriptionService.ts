// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export class AIDescriptionService {

    private static async getApiKey(utenteId: number) {
        // 1. Cerca chiave personale dell'utente
        const personal = await (prisma.configurazioneSistema as any).findFirst({
            where: {
                utenteId: utenteId,
                chiave: 'GEMINI_API_KEY'
            }
        });
        if (personal?.valore) return personal.valore;

        // 2. Cerca chiave globale (amministratore, utenteId null)
        const global = await (prisma.configurazioneSistema as any).findFirst({
            where: {
                utenteId: null,
                chiave: 'GEMINI_API_KEY'
            }
        });
        return global?.valore || process.env.GEMINI_API_KEY;
    }

    /**
     * Genera una descrizione HTML professionale usando AI
     */
    static async generateProductDescription(
        utenteId: number,
        nome: string,
        brand?: string,
        category?: string,
        specs?: any,
        bullets?: string[]
    ): Promise<string> {
        const apiKey = await this.getApiKey(utenteId);
        if (!apiKey) return this.generateFallbackDescription(nome, specs, bullets);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

            const specsContext = specs ? (typeof specs === 'string' ? specs : JSON.stringify(specs)) : 'N/D';
            const bulletsContext = bullets ? bullets.join(', ') : 'N/D';

            const prompt = `Sei un copywriter esperto di e-commerce. Genera una descrizione prodotto in FORMATO HTML per un sito Shopify.
Prodotto: ${nome}
Marca: ${brand || 'N/D'}
Categoria: ${category || 'N/D'}
Specifiche: ${specsContext}
Punti di forza: ${bulletsContext}

REQUISITI:
1. Usa tag HTML puliti (h3, p, ul, li). NO <html> o <body>.
2. Lingua ITALIANA.
3. Sii persuasivo ma professionale.
4. Dividi in: Introduzione, "Perché sceglierlo" (lista bullet), "Specifiche Tecniche" (tabella o lista).
5. NO prezzi, NO garanzie legali, NO link esterni.
Rispondi SOLO con il codice HTML contenuto in un div.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim().replace(/^```html|```$/g, '').trim();

        } catch (error: any) {
            logger.error(`Error generating AI description for ${nome}: ${error.message}`);
            return this.generateFallbackDescription(nome, specs, bullets);
        }
    }

    private static generateFallbackDescription(nome: string, specs?: any, bullets?: string[]): string {
        let html = `<div class="product-description"><h3>${nome}</h3>`;
        if (bullets && bullets.length > 0) {
            html += `<ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
        }
        if (specs) {
            html += `<p>Prodotto professionale di alta qualità ideale per professionisti e aziende.</p>`;
        }
        html += `</div>`;
        return html;
    }
}
