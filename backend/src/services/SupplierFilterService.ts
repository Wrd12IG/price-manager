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

/**
 * Servizio per gestire i filtri sui prodotti per fornitore
 */
export class SupplierFilterService {

    /**
     * Verifica se un prodotto deve essere incluso basandosi sui filtri del fornitore
     */
    async shouldIncludeProduct(
        fornitoreId: number,
        ean: string,
        marca: string | null,
        categoria: string | null
    ): Promise<FilterResult> {
        // Recupera il filtro attivo per questo fornitore
        const filter = await prisma.supplierFilter.findFirst({
            where: {
                fornitoreId,
                attivo: true
            }
        });

        // Se non c'è filtro, includi tutto
        if (!filter) {
            return {
                shouldInclude: true,
                reason: 'Nessun filtro attivo per questo fornitore'
            };
        }

        // Parse dei filtri JSON
        const config: SupplierFilterConfig = {
            marcheIncluse: filter.marcheIncluse ? JSON.parse(filter.marcheIncluse) : undefined,
            marcheEscluse: filter.marcheEscluse ? JSON.parse(filter.marcheEscluse) : undefined,
            categorieIncluse: filter.categorieIncluse ? JSON.parse(filter.categorieIncluse) : undefined,
            categorieEscluse: filter.categorieEscluse ? JSON.parse(filter.categorieEscluse) : undefined,
            eanInclusi: filter.eanInclusi ? JSON.parse(filter.eanInclusi) : undefined,
            eanEsclusi: filter.eanEsclusi ? JSON.parse(filter.eanEsclusi) : undefined
        };

        // 1. Verifica EAN esclusi (priorità massima)
        if (config.eanEsclusi && config.eanEsclusi.includes(ean)) {
            return {
                shouldInclude: false,
                reason: `EAN ${ean} esplicitamente escluso`
            };
        }

        // 2. Verifica EAN inclusi (se specificati, hanno priorità)
        if (config.eanInclusi && config.eanInclusi.length > 0) {
            if (config.eanInclusi.includes(ean)) {
                return {
                    shouldInclude: true,
                    reason: `EAN ${ean} esplicitamente incluso`
                };
            }
            // Se ci sono EAN inclusi ma questo non è tra quelli, escludi
            return {
                shouldInclude: false,
                reason: 'EAN non nella lista degli inclusi'
            };
        }

        // 3. Verifica marche escluse
        if (marca && config.marcheEscluse) {
            const marcaNormalized = marca.trim().toUpperCase();
            const isExcluded = config.marcheEscluse.some(m =>
                m.trim().toUpperCase() === marcaNormalized
            );
            if (isExcluded) {
                return {
                    shouldInclude: false,
                    reason: `Marca ${marca} esclusa`
                };
            }
        }

        // 4. Verifica marche incluse
        if (config.marcheIncluse && config.marcheIncluse.length > 0) {
            if (!marca) {
                return {
                    shouldInclude: false,
                    reason: 'Marca non specificata e filtro marche attivo'
                };
            }
            const marcaNormalized = marca.trim().toUpperCase();
            const isIncluded = config.marcheIncluse.some(m =>
                m.trim().toUpperCase() === marcaNormalized
            );
            if (!isIncluded) {
                return {
                    shouldInclude: false,
                    reason: `Marca ${marca} non nella lista delle incluse`
                };
            }
        }

        // 5. Verifica categorie escluse
        if (categoria && config.categorieEscluse) {
            const categoriaNormalized = categoria.trim().toLowerCase();
            const isExcluded = config.categorieEscluse.some(c =>
                c.trim().toLowerCase() === categoriaNormalized
            );
            if (isExcluded) {
                return {
                    shouldInclude: false,
                    reason: `Categoria ${categoria} esclusa`
                };
            }
        }

        // 6. Verifica categorie incluse
        if (config.categorieIncluse && config.categorieIncluse.length > 0) {
            if (!categoria) {
                return {
                    shouldInclude: false,
                    reason: 'Categoria non specificata e filtro categorie attivo'
                };
            }
            const categoriaNormalized = categoria.trim().toLowerCase();
            const isIncluded = config.categorieIncluse.some(c =>
                c.trim().toLowerCase() === categoriaNormalized
            );
            if (!isIncluded) {
                return {
                    shouldInclude: false,
                    reason: `Categoria ${categoria} non nella lista delle incluse`
                };
            }
        }

        // Se passa tutti i filtri, includi
        return {
            shouldInclude: true,
            reason: 'Prodotto passa tutti i filtri'
        };
    }

    /**
     * Ottiene le opzioni disponibili per un fornitore (marche e categorie)
     */
    async getAvailableOptions(fornitoreId: number) {
        const marche = await prisma.listinoRaw.findMany({
            where: {
                fornitoreId,
                marca: { not: null }
            },
            select: { marca: true },
            distinct: ['marca']
        });

        const categorie = await prisma.listinoRaw.findMany({
            where: {
                fornitoreId,
                categoriaFornitore: { not: null }
            },
            select: { categoriaFornitore: true },
            distinct: ['categoriaFornitore']
        });

        return {
            marche: marche.map((m: any) => m.marca).filter(Boolean).sort(),
            categorie: categorie.map((c: any) => c.categoriaFornitore).filter(Boolean).sort()
        };
    }

    /**
     * Crea o aggiorna un filtro per un fornitore
     */
    async upsertFilter(
        fornitoreId: number,
        nome: string,
        config: SupplierFilterConfig,
        note?: string
    ) {
        // Disattiva eventuali filtri esistenti per questo fornitore
        await prisma.supplierFilter.updateMany({
            where: { fornitoreId, attivo: true },
            data: { attivo: false }
        });

        // Crea il nuovo filtro
        return await prisma.supplierFilter.create({
            data: {
                fornitoreId,
                nome,
                marcheIncluse: config.marcheIncluse ? JSON.stringify(config.marcheIncluse) : null,
                marcheEscluse: config.marcheEscluse ? JSON.stringify(config.marcheEscluse) : null,
                categorieIncluse: config.categorieIncluse ? JSON.stringify(config.categorieIncluse) : null,
                categorieEscluse: config.categorieEscluse ? JSON.stringify(config.categorieEscluse) : null,
                eanInclusi: config.eanInclusi ? JSON.stringify(config.eanInclusi) : null,
                eanEsclusi: config.eanEsclusi ? JSON.stringify(config.eanEsclusi) : null,
                attivo: true,
                note
            }
        });
    }

    /**
     * Ottiene il filtro attivo per un fornitore
     */
    async getActiveFilter(fornitoreId: number) {
        const filter = await prisma.supplierFilter.findFirst({
            where: {
                fornitoreId,
                attivo: true
            },
            include: {
                fornitore: {
                    select: { nomeFornitore: true }
                }
            }
        });

        if (!filter) return null;

        return {
            ...filter,
            marcheIncluse: filter.marcheIncluse ? JSON.parse(filter.marcheIncluse) : [],
            marcheEscluse: filter.marcheEscluse ? JSON.parse(filter.marcheEscluse) : [],
            categorieIncluse: filter.categorieIncluse ? JSON.parse(filter.categorieIncluse) : [],
            categorieEscluse: filter.categorieEscluse ? JSON.parse(filter.categorieEscluse) : [],
            eanInclusi: filter.eanInclusi ? JSON.parse(filter.eanInclusi) : [],
            eanEsclusi: filter.eanEsclusi ? JSON.parse(filter.eanEsclusi) : []
        };
    }

    /**
     * Ottiene tutti i filtri per tutti i fornitori
     */
    async getAllFilters() {
        const filters = await prisma.supplierFilter.findMany({
            include: {
                fornitore: {
                    select: { nomeFornitore: true }
                }
            },
            orderBy: [
                { attivo: 'desc' },
                { fornitoreId: 'asc' }
            ]
        });

        return filters.map(filter => ({
            ...filter,
            marcheIncluse: filter.marcheIncluse ? JSON.parse(filter.marcheIncluse) : [],
            marcheEscluse: filter.marcheEscluse ? JSON.parse(filter.marcheEscluse) : [],
            categorieIncluse: filter.categorieIncluse ? JSON.parse(filter.categorieIncluse) : [],
            categorieEscluse: filter.categorieEscluse ? JSON.parse(filter.categorieEscluse) : [],
            eanInclusi: filter.eanInclusi ? JSON.parse(filter.eanInclusi) : [],
            eanEsclusi: filter.eanEsclusi ? JSON.parse(filter.eanEsclusi) : []
        }));
    }

    /**
     * Elimina un filtro
     */
    async deleteFilter(id: number) {
        return await prisma.supplierFilter.delete({
            where: { id }
        });
    }

    /**
     * Attiva/disattiva un filtro
     */
    async toggleFilter(id: number, attivo: boolean) {
        const filter = await prisma.supplierFilter.findUnique({
            where: { id }
        });

        if (!filter) {
            throw new Error('Filtro non trovato');
        }

        // Se stiamo attivando questo filtro, disattiva gli altri dello stesso fornitore
        if (attivo) {
            await prisma.supplierFilter.updateMany({
                where: {
                    fornitoreId: filter.fornitoreId,
                    id: { not: id },
                    attivo: true
                },
                data: { attivo: false }
            });
        }

        return await prisma.supplierFilter.update({
            where: { id },
            data: { attivo }
        });
    }
}

export const supplierFilterService = new SupplierFilterService();
