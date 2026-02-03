// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export class AITitleService {

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
     * Genera un titolo professionale per un prodotto usando AI
     */
    static async generateProductTitle(
        utenteId: number,
        ean: string,
        brand?: string,
        category?: string,
        currentTitle?: string,
        description?: string,
        specs?: any
    ): Promise<string> {
        const apiKey = await this.getApiKey(utenteId);
        if (!apiKey) return this.generateFallbackTitle(ean, brand, category);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

            let featuresContext = '';
            if (specs) {
                const specsObj = typeof specs === 'string' ? JSON.parse(specs) : specs;
                const keySpecs: string[] = [];
                const commonKeys = ['cpu', 'processor', 'ram', 'memory', 'storage', 'hdd', 'ssd', 'display', 'screen', 'monitor', 'vga', 'gpu', 'os', 'system'];

                if (Array.isArray(specsObj)) {
                    specsObj.forEach((s: any) => {
                        if (commonKeys.some(k => s.name?.toLowerCase().includes(k))) {
                            keySpecs.push(`${s.name}: ${s.value}`);
                        }
                    });
                } else {
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
${currentTitle ? `Titolo attuale: ${currentTitle}` : ''}
${description ? `Descrizione: ${description.substring(0, 500)}...` : ''}${featuresContext}

REQUISITI:
1. Massimo 75 caratteri
2. Lingua ITALIANA
3. NO EAN nel titolo
4. Formato: Marca Modello - Spec1 - Spec2
Rispondi SOLO con il titolo.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim().replace(/^["']|["']$/g, '').trim();

        } catch (error: any) {
            logger.error(`Error generating AI title for EAN ${ean}: ${error.message}`);
            return this.generateFallbackTitle(ean, brand, category);
        }
    }

    private static generateFallbackTitle(ean: string, brand?: string, category?: string): string {
        const parts = [];
        if (brand) parts.push(brand);
        if (category && category !== 'Default') parts.push(category);
        return parts.length > 0 ? parts.join(' - ') : 'Prodotto Professionale';
    }

    static needsImprovement(title: string): boolean {
        if (!title || title.length < 15) return true;
        if (/^[0-9\.\-]+$/.test(title)) return true;
        const genericTerms = ['prodotto', 'articolo', 'item', 'product'];
        return genericTerms.some(term => title.toLowerCase().includes(term));
    }

    static async improveTitlesBatch(
        utenteId: number,
        products: Array<{ ean: string; brand?: string; category?: string; currentTitle: string }>
    ): Promise<Map<string, string>> {
        const results = new Map<string, string>();
        for (const product of products) {
            if (this.needsImprovement(product.currentTitle)) {
                const newTitle = await this.generateProductTitle(utenteId, product.ean, product.brand, product.category, product.currentTitle);
                results.set(product.ean, newTitle);
                await new Promise(r => setTimeout(r, 500));
            }
        }
        return results;
    }
}
