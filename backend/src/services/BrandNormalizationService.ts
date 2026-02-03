// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export class BrandNormalizationService {
    private static genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    private static cache = new Map<string, string>();

    /**
     * Normalizza un marchio usando l'AI o la cache
     */
    static async normalizeBrand(rawBrand: string): Promise<string> {
        if (!rawBrand) return '';

        const cleanRaw = rawBrand.trim().toUpperCase();

        // 1. Controlla Cache in memoria
        if (this.cache.has(cleanRaw)) {
            return this.cache.get(cleanRaw)!;
        }

        // 2. Controlla nel DB se il nome GREZZO esiste già come marchio noto
        const existingRaw = await prisma.marchio.findFirst({
            where: { normalizzato: cleanRaw }
        });

        if (existingRaw) {
            this.cache.set(cleanRaw, existingRaw.nome);
            return existingRaw.nome;
        }

        // 3. Chiedi all'AI il nome UFFICIALE (solo se marchio sconosciuto)
        let officialName = rawBrand;
        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `Sei un esperto di catalogo hardware. Normalizza questo marchio al suo nome ufficiale e più breve possibile.
            Esempi: "HP INC" -> "HP", "Asustek" -> "Asus", "TP-LINK ITALY" -> "TP-Link", "Western Digital Technologies" -> "Western Digital".
            Input: "${rawBrand}"
            Restituisci solo il nome pulito senza commenti:`;

            const result = await model.generateContent(prompt);
            officialName = result.response.text().trim();
        } catch (e) {
            logger.warn(`AI Normalization failed for ${rawBrand}, using raw.`);
        }

        // 4. Cerca nel DB se questo nome ufficiale (o la sua forma normalizzata) esiste già
        const cleanOfficial = officialName.trim().toUpperCase();
        const existing = await prisma.marchio.findFirst({
            where: {
                OR: [
                    { nome: { equals: officialName, mode: 'insensitive' } },
                    { normalizzato: cleanOfficial }
                ]
            }
        });

        const finalName = existing ? existing.nome : officialName;

        // 5. Salva in cache
        this.cache.set(cleanRaw, finalName);
        return finalName;
    }
}
