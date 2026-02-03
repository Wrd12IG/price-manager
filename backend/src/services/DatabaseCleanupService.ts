// @ts-nocheck
import prisma from '../config/database';
import { BrandNormalizationService } from './BrandNormalizationService';
import { logger } from '../utils/logger';

/**
 * Script per la pulizia massiva dei marchi nel database.
 * Identifica i duplicati, li unifica e aggiorna i riferimenti nel Master File.
 */
export class DatabaseCleanupService {
    static async cleanupBrands(): Promise<{ totalBefore: number; totalAfter: number; merged: number }> {
        logger.info('🧹 Inizio pulizia massiva dei marchi...');

        const allBrands = await prisma.marchio.findMany();
        const totalBefore = allBrands.length;
        let mergedCount = 0;

        // Mappa: nome_normalizzato_ai -> ID_marchio_principale
        const canonicalBrands = new Map<string, number>();

        for (const brand of allBrands) {
            const normalizedName = await BrandNormalizationService.normalizeBrand(brand.nome);
            const key = normalizedName.toLowerCase().trim();

            if (!canonicalBrands.has(key)) {
                // Primo marchio "ufficiale" trovato per questo nome
                if (brand.nome !== normalizedName) {
                    // Aggiorna il nome se l'AI suggerisce una forma migliore
                    await prisma.marchio.update({
                        where: { id: brand.id },
                        data: { nome: normalizedName, normalizzato: normalizedName.toUpperCase() }
                    });
                }
                canonicalBrands.set(key, brand.id);
            } else {
                // Trovato un duplicato!
                const targetId = canonicalBrands.get(key)!;

                logger.info(`🔗 Merging "${brand.nome}" (ID ${brand.id}) into "${normalizedName}" (ID ${targetId})`);

                // 1. Aggiorna MasterFile
                await prisma.masterFile.updateMany({
                    where: { marchioId: brand.id },
                    data: { marchioId: targetId }
                });

                // 2. Aggiorna Regole Markup
                await prisma.regolaMarkup.updateMany({
                    where: { marchioId: brand.id },
                    data: { marchioId: targetId }
                });

                // 3. Elimina il duplicato
                await prisma.marchio.delete({
                    where: { id: brand.id }
                });

                mergedCount++;
            }
        }

        const totalAfter = await prisma.marchio.count();
        logger.info(`✨ Pulizia completata. Marchi rimossi: ${mergedCount}. Rimanenti: ${totalAfter}`);

        return { totalBefore, totalAfter, merged: mergedCount };
    }
}
