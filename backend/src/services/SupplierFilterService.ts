// @ts-nocheck
import prisma from '../config/database';

export interface SupplierFilterConfig {
    marcheIncluse?: string[];
    marcheEscluse?: string[];
    categorieIncluse?: string[];
    categorieEscluse?: string[];
    eanInclusi?: string[];
    eanEsclusi?: string[];
}

export interface FilterResult {
    shouldInclude: boolean;
    reason?: string;
}

export class SupplierFilterService {

    async shouldIncludeProduct(
        utenteId: number,
        fornitoreId: number,
        ean: string,
        marca: string | null,
        categoria: string | null
    ): Promise<FilterResult> {
        const filter = await prisma.supplierFilter.findFirst({
            where: { utenteId, fornitoreId, attivo: true }
        });

        if (!filter) return { shouldInclude: true, reason: 'Nessun filtro attivo' };

        const config: SupplierFilterConfig = {
            marcheIncluse: filter.marcheIncluse ? JSON.parse(filter.marcheIncluse) : [],
            marcheEscluse: filter.marcheEscluse ? JSON.parse(filter.marcheEscluse) : [],
            categorieIncluse: filter.categorieIncluse ? JSON.parse(filter.categorieIncluse) : [],
            categorieEscluse: filter.categorieEscluse ? JSON.parse(filter.categorieEscluse) : [],
            eanInclusi: filter.eanInclusi ? JSON.parse(filter.eanInclusi) : [],
            eanEsclusi: filter.eanEsclusi ? JSON.parse(filter.eanEsclusi) : []
        };

        if (config.eanEsclusi?.includes(ean)) return { shouldInclude: false, reason: 'EAN escluso' };
        if (config.eanInclusi?.length && !config.eanInclusi.includes(ean)) return { shouldInclude: false, reason: 'EAN non incluso' };

        if (marca) {
            const mNorm = marca.toUpperCase();
            if (config.marcheEscluse?.some(m => m.toUpperCase() === mNorm)) return { shouldInclude: false, reason: 'Marca esclusa' };
            if (config.marcheIncluse?.length && !config.marcheIncluse.some(m => m.toUpperCase() === mNorm)) return { shouldInclude: false, reason: 'Marca non inclusa' };
        }

        return { shouldInclude: true, reason: 'Ok' };
    }

    async getAvailableOptions(utenteId: number, fornitoreId: number) {
        const [marche, categorie] = await Promise.all([
            prisma.listinoRaw.findMany({ where: { utenteId, fornitoreId, marca: { not: null } }, select: { marca: true }, distinct: ['marca'] }),
            prisma.listinoRaw.findMany({ where: { utenteId, fornitoreId, categoriaFornitore: { not: null } }, select: { categoriaFornitore: true }, distinct: ['categoriaFornitore'] })
        ]);

        return {
            marche: marche.map(m => m.marca).filter(Boolean).sort(),
            categorie: categorie.map(c => c.categoriaFornitore).filter(Boolean).sort()
        };
    }

    async upsertFilter(utenteId: number, fornitoreId: number, nome: string, config: SupplierFilterConfig) {
        await prisma.supplierFilter.updateMany({
            where: { utenteId, fornitoreId, attivo: true },
            data: { attivo: false }
        });

        return prisma.supplierFilter.create({
            data: {
                utenteId,
                fornitoreId,
                nome,
                marcheIncluse: JSON.stringify(config.marcheIncluse || []),
                marcheEscluse: JSON.stringify(config.marcheEscluse || []),
                categorieIncluse: JSON.stringify(config.categorieIncluse || []),
                categorieEscluse: JSON.stringify(config.categorieEscluse || []),
                eanInclusi: JSON.stringify(config.eanInclusi || []),
                eanEsclusi: JSON.stringify(config.eanEsclusi || []),
                attivo: true
            }
        });
    }

    async getActiveFilter(utenteId: number, fornitoreId: number) {
        return prisma.supplierFilter.findFirst({
            where: { utenteId, fornitoreId, attivo: true }
        });
    }

    async getAllFilters(utenteId: number) {
        return prisma.supplierFilter.findMany({
            where: { utenteId },
            include: { fornitore: true },
            orderBy: { fornitoreId: 'asc' }
        });
    }

    async deleteFilter(utenteId: number, id: number) {
        return prisma.supplierFilter.deleteMany({
            where: { id, utenteId }
        });
    }

    async toggleFilter(utenteId: number, id: number, attivo: boolean) {
        const filter = await prisma.supplierFilter.findFirst({ where: { id, utenteId } });
        if (!filter) throw new Error('Filtro non trovato');

        if (attivo) {
            await prisma.supplierFilter.updateMany({
                where: { utenteId, fornitoreId: filter.fornitoreId, id: { not: id } },
                data: { attivo: false }
            });
        }

        return prisma.supplierFilter.update({
            where: { id },
            data: { attivo }
        });
    }
}

export const supplierFilterService = new SupplierFilterService();
