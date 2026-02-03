// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';

export class NormalizationService {

    /**
     * Ottiene ID del marchio normalizzato tramite alias o nome esatto
     */
    static async getNormalizedBrandId(name: string, utenteId: number | null = null): Promise<number | null> {
        if (!name) return null;
        const cleanName = name.trim();

        // 1. Controlla Alias (utente specifico o globale)
        const alias = await prisma.brandAlias.findFirst({
            where: {
                alias: cleanName,
                OR: [{ utenteId }, { utenteId: null }]
            }
        });

        if (alias) return alias.targetId;

        // 2. Controlla se esiste già come Marchio
        const brand = await prisma.marchio.findUnique({
            where: { nome: cleanName }
        });

        return brand?.id || null;
    }

    /**
     * Ottiene ID della categoria normalizzata
     */
    static async getNormalizedCategoryId(name: string, utenteId: number | null = null): Promise<number | null> {
        if (!name) return null;
        const cleanName = name.trim();

        const alias = await prisma.categoryAlias.findFirst({
            where: {
                alias: cleanName,
                OR: [{ utenteId }, { utenteId: null }]
            }
        });

        if (alias) return alias.targetId;

        const cat = await prisma.categoria.findUnique({
            where: { nome: cleanName }
        });

        return cat?.id || null;
    }

    /**
     * Identifica potenziali duplicati basandosi su nomi simili
     */
    static async getPotentialDuplicates(type: 'brand' | 'category') {
        const items = type === 'brand'
            ? await prisma.marchio.findMany({ select: { id: true, nome: true } })
            : await prisma.categoria.findMany({ select: { id: true, nome: true } });

        const potential = [];

        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const name1 = items[i].nome.toLowerCase().replace(/[^a-z0-9]/g, '');
                const name2 = items[j].nome.toLowerCase().replace(/[^a-z0-9]/g, '');

                if (name1 === name2 || name1.includes(name2) || name2.includes(name1)) {
                    potential.push({
                        item1: items[i],
                        item2: items[j],
                        reason: 'Similar name'
                    });
                }
            }
        }

        return potential;
    }

    /**
     * Unisce due record: source viene eliminato e rimpiazzato da target ovunque
     */
    static async merge(type: 'brand' | 'category', sourceId: number, targetId: number, utenteId: number | null = null) {
        logger.info(`Merging ${type} ${sourceId} into ${targetId}`);

        if (sourceId === targetId) return;

        return await prisma.$transaction(async (tx) => {
            const source = type === 'brand'
                ? await tx.marchio.findUnique({ where: { id: sourceId } })
                : await tx.categoria.findUnique({ where: { id: sourceId } });

            if (!source) throw new Error(`${type} sorgente non trovato`);

            // 1. Aggiorna MasterFile
            if (type === 'brand') {
                await tx.masterFile.updateMany({
                    where: { marchioId: sourceId },
                    data: { marchioId: targetId }
                });

                // Crea Alias
                await tx.brandAlias.upsert({
                    where: { alias: source.nome },
                    create: { alias: source.nome, targetId, utenteId },
                    update: { targetId }
                });

                // Elimina vecchio marchio
                await tx.marchio.delete({ where: { id: sourceId } });

            } else {
                await tx.masterFile.updateMany({
                    where: { categoriaId: sourceId },
                    data: { categoriaId: targetId }
                });

                // Crea Alias
                await tx.categoryAlias.upsert({
                    where: { alias: source.nome },
                    create: { alias: source.nome, targetId, utenteId },
                    update: { targetId }
                });

                // Elimina vecchia categoria
                await tx.categoria.delete({ where: { id: sourceId } });
            }
        });
    }

    /**
     * Lista tutti i marchi/categorie con conteggi prodotti
     */
    static async getStats(type: 'brand' | 'category') {
        if (type === 'brand') {
            const items = await prisma.marchio.findMany({
                include: {
                    _count: { select: { masterFiles: true } },
                    aliases: true
                },
                orderBy: { nome: 'asc' }
            });
            return items;
        } else {
            const items = await prisma.categoria.findMany({
                include: {
                    _count: { select: { masterFiles: true } },
                    aliases: true
                },
                orderBy: { nome: 'asc' }
            });
            return items;
        }
    }
}
