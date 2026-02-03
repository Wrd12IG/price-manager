// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ProductFilterService } from './ProductFilterService';
import { IcecatUtils } from '../utils/IcecatUtils';
import { jobProgressManager } from './JobProgressService';

/**
 * Servizio per la consolidazione del Master File.
 */
export class MasterFileService {

    private static activeConsolidations: Set<number> = new Set();

    private static isValidEAN(ean: string | null): boolean {
        if (!ean) return false;
        const cleaned = String(ean).trim();
        if (cleaned === '' || cleaned === '0' || /^0+$/.test(cleaned)) return false;
        if (cleaned.length < 8) return false;
        return true;
    }

    /**
     * Consolida i prodotti da ListinoRaw in MasterFile applicando i filtri prodotti
     */
    static async consolidaMasterFile(utenteId: number): Promise<{
        totalRaw: number;
        filtered: number;
        consolidated: number;
        excluded: number;
    }> {
        if (this.activeConsolidations.has(utenteId)) {
            logger.warn(`⚠️ [Utente ${utenteId}] Consolidamento già in corso, salto...`);
            return { totalRaw: 0, filtered: 0, consolidated: 0, excluded: 0 };
        }

        this.activeConsolidations.add(utenteId);

        try {
            logger.info(`🔄 [Utente ${utenteId}] Inizio consolidamento Master File`);

            const startTime = Date.now();
            const filterService = new ProductFilterService();

            const jobId = jobProgressManager.createJob('merge', { utenteId });
            jobProgressManager.startJob(jobId, 'Inizio consolidamento Master File...');

            try {
                // 1. Recupera tutti i prodotti raw dell'utente
                const rawProducts = await prisma.listinoRaw.findMany({
                    where: { utenteId },
                    include: {
                        fornitore: true
                    }
                });

                logger.info(`📦 [Utente ${utenteId}] Trovati ${rawProducts.length} record raw`);
                jobProgressManager.updateProgress(jobId, 10, `Trovati ${rawProducts.length} prodotti da elaborare`);

                if (rawProducts.length === 0) {
                    jobProgressManager.completeJob(jobId, 'Nessun prodotto da consolidare');
                    return { totalRaw: 0, filtered: 0, consolidated: 0, excluded: 0 };
                }

                // --- Aggregazione record per SKU dello stesso fornitore ---
                const skuMergedMap = new Map<string, any>();
                for (const rawProduct of rawProducts) {
                    const key = `${rawProduct.fornitoreId}_${rawProduct.skuFornitore}`;
                    const existing = skuMergedMap.get(key);
                    if (!existing) {
                        skuMergedMap.set(key, { ...rawProduct });
                    } else {
                        if (!existing.eanGtin && rawProduct.eanGtin) existing.eanGtin = rawProduct.eanGtin;
                        if (!existing.partNumber && rawProduct.partNumber) existing.partNumber = rawProduct.partNumber;
                        if (existing.quantitaDisponibile === 0) existing.quantitaDisponibile = rawProduct.quantitaDisponibile;
                    }
                }

                const mergedProducts = Array.from(skuMergedMap.values());

                // 2. Applica filtri prodotti dell'utente
                const { includedProducts, excludedProducts } = await this.applyProductFilters(
                    utenteId,
                    mergedProducts,
                    filterService
                );

                jobProgressManager.updateProgress(jobId, 40, `Filtri applicati: ${includedProducts.length} prodotti inclusi`);

                // 3. Raggruppa e seleziona miglior fornitore (LOGICA CROSS-FORNITORE DELLO STESSO UTENTE)
                const consolidatedProducts = await this.consolidateProducts(includedProducts);
                jobProgressManager.updateProgress(jobId, 70, `Prodotti consolidati: ${consolidatedProducts.length}`);

                // 4. Salva in MasterFile dell'utente
                await this.saveMasterFile(utenteId, consolidatedProducts);
                jobProgressManager.updateProgress(jobId, 90, 'Salvataggio catalogo in corso...');

                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                logger.info(`✨ [Utente ${utenteId}] Consolidamento completato in ${duration}s`);

                // 5. Applica regole di markup dell'utente
                const { MarkupService } = await import('./MarkupService');
                await MarkupService.applicaRegolePrezzi(utenteId);

                jobProgressManager.completeJob(jobId, `Consolidati ${consolidatedProducts.length} prodotti con successo`);

                return {
                    totalRaw: rawProducts.length,
                    filtered: includedProducts.length,
                    consolidated: consolidatedProducts.length,
                    excluded: excludedProducts.length
                };

            } catch (error: any) {
                logger.error(`❌ Errore consolidamento utente ${utenteId}:`, error);
                if (typeof jobId !== 'undefined') jobProgressManager.failJob(jobId, error.message);
                throw error;
            }
        } finally {
            this.activeConsolidations.delete(utenteId);
        }
    }

    /**
     * Applica i filtri prodotti dell'utente
     */
    private static async applyProductFilters(
        utenteId: number,
        rawProducts: any[],
        filterService: ProductFilterService
    ): Promise<{
        includedProducts: any[];
        excludedProducts: any[];
    }> {
        const includedProducts: any[] = [];
        const excludedProducts: any[] = [];

        const activeRules = await filterService.getActiveRules(utenteId);

        if (activeRules.length === 0) {
            return { includedProducts: rawProducts, excludedProducts: [] };
        }

        for (const product of rawProducts) {
            const filterResult = await filterService.evaluateRules(
                utenteId,
                activeRules,
                product.marca,
                product.categoriaFornitore
            );

            if (filterResult.shouldInclude) {
                includedProducts.push(product);
            } else {
                excludedProducts.push(product);
            }
        }

        return { includedProducts, excludedProducts };
    }

    private static async consolidateProducts(products: any[]): Promise<any[]> {
        // 1. Mappatura PartNumber -> Miglior EAN trovato tra tutti i fornitori
        // Questo serve per i casi in cui un fornitore ha EAN "0" o NULL ma altri hanno l'EAN corretto
        const pnToEanMap = new Map<string, string>();
        for (const p of products) {
            if (p.marca && p.partNumber && this.isValidEAN(p.eanGtin)) {
                const key = `${p.marca.toUpperCase().trim()}:${p.partNumber.toUpperCase().trim()}`;
                if (!pnToEanMap.has(key)) {
                    pnToEanMap.set(key, p.eanGtin!.trim());
                }
            }
        }

        const grouped = new Map<string, any[]>();

        for (const product of products) {
            let key: string | null = null;
            let finalEan = product.eanGtin;

            // Tentativo di recupero EAN se mancante o invalido
            if (!this.isValidEAN(finalEan) && product.marca && product.partNumber) {
                const lookupKey = `${product.marca.toUpperCase().trim()}:${product.partNumber.toUpperCase().trim()}`;
                if (pnToEanMap.has(lookupKey)) {
                    finalEan = pnToEanMap.get(lookupKey);
                }
            }

            // Normalizzazione EAN finale (se ancora invalido trattiamolo come nullo per la chiave)
            const cleanEan = this.isValidEAN(finalEan) ? finalEan!.trim() : null;

            if (cleanEan) {
                key = `EAN:${cleanEan}`;
                product.eanGtin = cleanEan; // Aggiorniamo il prodotto con l'EAN migliore trovato
            } else if (product.marca && product.partNumber) {
                const cleanBrand = product.marca.replace(/[^a-z0-9]/gi, '').toUpperCase();
                const cleanPN = product.partNumber.replace(/[^a-z0-9]/gi, '').toUpperCase();
                key = `MPN:${cleanBrand}:${cleanPN}`;
            }

            if (!key) continue;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(product);
        }

        const consolidated: any[] = [];
        for (const [key, variants] of grouped) {
            // Non filtriamo più per prezzo > 0, prendiamo tutto
            const allVariants = [...variants];

            // Ordiniamo per dare priorità a:
            // 1. Varianti con prezzo > 0
            // 2. Prezzo più basso (tra quelli > 0)
            // 3. Maggior quantità
            allVariants.sort((a, b) => {
                const pA = a.prezzoAcquisto || 0;
                const pB = b.prezzoAcquisto || 0;

                if (pA > 0 && pB <= 0) return -1;
                if (pA <= 0 && pB > 0) return 1;

                if (pA !== pB) return pA - pB;
                return b.quantitaDisponibile - a.quantitaDisponibile;
            });

            const bestVariant = allVariants[0];
            const totalQuantity = allVariants.reduce((sum, v) => sum + (v.quantitaDisponibile || 0), 0);

            consolidated.push({
                ...bestVariant,
                _totalQuantity: totalQuantity
            });
        }

        return consolidated;
    }

    private static async saveMasterFile(utenteId: number, products: any[]): Promise<void> {
        // 1. BACKUP DATI ICECAT
        const existingIcecatData = await prisma.datiIcecat.findMany({
            where: { masterFile: { utenteId } }
        });
        const icecatBackup = new Map<string, any>();
        existingIcecatData.forEach(d => { if (d.eanGtin) icecatBackup.set(d.eanGtin, d); });

        // 2. SVUOTA MASTERFILE UTENTE
        await prisma.masterFile.deleteMany({ where: { utenteId } });

        // 3. CACHE MARCHI E CATEGORIE
        const marchiMap = new Map<string, number>();
        const categorieMap = new Map<string, number>();

        const [existingMarchi, existingCat, brandAliases, catAliases] = await Promise.all([
            prisma.marchio.findMany(),
            prisma.categoria.findMany(),
            prisma.brandAlias.findMany({ where: { OR: [{ utenteId }, { utenteId: null }] } }),
            prisma.categoryAlias.findMany({ where: { OR: [{ utenteId }, { utenteId: null }] } })
        ]);

        existingMarchi.forEach(m => marchiMap.set(m.nome.toLowerCase().trim(), m.id));
        existingCat.forEach(c => categorieMap.set(c.nome.toLowerCase().trim(), c.id));

        brandAliases.forEach(a => marchiMap.set(a.alias.toLowerCase().trim(), a.targetId));
        catAliases.forEach(a => categorieMap.set(a.alias.toLowerCase().trim(), a.targetId));

        // 4. PRE-ELABORA MARCHI E CATEGORIE MANCANTI
        const missingBrands = new Set<string>();
        const missingCats = new Set<string>();

        for (const product of products) {
            if (product.marca) {
                const brandKey = product.marca.toLowerCase().trim();
                if (!marchiMap.has(brandKey)) missingBrands.add(product.marca.trim());
            }
            if (product.categoriaFornitore) {
                const catKey = product.categoriaFornitore.toLowerCase().trim();
                if (!categorieMap.has(catKey)) missingCats.add(product.categoriaFornitore.trim());
            }
        }

        if (missingBrands.size > 0) {
            const brandsToCreate = Array.from(missingBrands).map(name => ({
                nome: name,
                normalizzato: name.toUpperCase(),
                attivo: true
            }));
            try {
                await prisma.marchio.createMany({ data: brandsToCreate, skipDuplicates: true });
                const newMarchi = await prisma.marchio.findMany({
                    where: { nome: { in: Array.from(missingBrands) } }
                });
                newMarchi.forEach(m => marchiMap.set(m.nome.toLowerCase().trim(), m.id));
            } catch (e) {
                logger.error('Errore batch creazione marchi:', e);
            }
        }

        if (missingCats.size > 0) {
            const catsToCreate = Array.from(missingCats).map(name => ({
                nome: name,
                normalizzato: name.toUpperCase(),
                attivo: true
            }));
            try {
                await prisma.categoria.createMany({ data: catsToCreate, skipDuplicates: true });
                const newCats = await prisma.categoria.findMany({
                    where: { nome: { in: Array.from(missingCats) } }
                });
                newCats.forEach(c => categorieMap.set(c.nome.toLowerCase().trim(), c.id));
            } catch (e) {
                logger.error('Errore batch creazione categorie:', e);
            }
        }

        // 5. PREPARA INSERIMENTO
        const dataToInsert = [];
        for (const product of products) {
            try {
                let marchioId: number | null = null;
                if (product.marca) marchioId = marchiMap.get(product.marca.toLowerCase().trim()) || null;

                let categoriaId: number | null = null;
                if (product.categoriaFornitore) categoriaId = categorieMap.get(product.categoriaFornitore.toLowerCase().trim()) || null;

                dataToInsert.push({
                    utenteId,
                    eanGtin: product.eanGtin,
                    skuSelezionato: product.skuFornitore,
                    partNumber: product.partNumber,
                    fornitoreSelezionatoId: product.fornitoreId,
                    prezzoAcquistoMigliore: product.prezzoAcquisto,
                    prezzoVenditaCalcolato: product.prezzoAcquisto,
                    quantitaTotaleAggregata: product._totalQuantity || product.quantitaDisponibile,
                    marchioId,
                    categoriaId,
                    nomeProdotto: product.descrizioneOriginale
                });
            } catch (e) { }
        }

        const batchSize = 500;
        for (let i = 0; i < dataToInsert.length; i += batchSize) {
            await prisma.masterFile.createMany({ data: dataToInsert.slice(i, i + batchSize) });
        }

        // 6. RIPRISTINO DATI ICECAT
        if (icecatBackup.size > 0) {
            const newMFs = await prisma.masterFile.findMany({
                where: { utenteId },
                select: { id: true, eanGtin: true }
            });
            const toRestore = newMFs.map(mf => {
                const b = icecatBackup.get(mf.eanGtin || '');
                if (!b) return null;
                return {
                    masterFileId: mf.id,
                    eanGtin: mf.eanGtin,
                    descrizioneBrave: b.descrizioneBrave,
                    descrizioneLunga: b.descrizioneLunga,
                    specificheTecnicheJson: b.specificheTecnicheJson,
                    urlImmaginiJson: b.urlImmaginiJson,
                    bulletPointsJson: b.bulletPointsJson,
                    documentiJson: b.documentiJson,
                    linguaOriginale: b.linguaOriginale,
                    dataScaricamento: b.dataScaricamento
                };
            }).filter(x => x !== null) as any[];

            for (let i = 0; i < toRestore.length; i += batchSize) {
                await prisma.datiIcecat.createMany({ data: toRestore.slice(i, i + batchSize) });
            }
        }
    }

    static async getStats(utenteId: number): Promise<any> {
        const prodCount = await prisma.masterFile.count({ where: { utenteId } });
        const icecatCount = await prisma.datiIcecat.count({ where: { masterFile: { utenteId } } });
        return { totalProducts: prodCount, enrichedIcecat: icecatCount };
    }

    static async getMasterFile(utenteId: number, page: number = 1, limit: number = 50, search: string = '', filters: any = {}): Promise<any> {
        const skip = (page - 1) * limit;
        const where: any = { utenteId };

        if (search) {
            where.OR = [
                { eanGtin: { contains: search } },
                { skuSelezionato: { contains: search } },
                { nomeProdotto: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (filters.marchioId) where.marchioId = filters.marchioId;
        if (filters.categoriaId) where.categoriaId = filters.categoriaId;
        if (filters.fornitoreId) where.fornitoreSelezionatoId = filters.fornitoreId;
        if (filters.soloDisponibili) where.quantitaTotaleAggregata = { gt: 0 };

        const total = await prisma.masterFile.count({ where });
        const products = await prisma.masterFile.findMany({
            where, skip, take: limit,
            include: {
                fornitoreSelezionato: { select: { nomeFornitore: true } },
                marchio: { select: { nome: true } },
                categoria: { select: { nome: true } },
                datiIcecat: { select: { urlImmaginiJson: true } },
                outputShopify: { select: { id: true, statoCaricamento: true } }
            },
            orderBy: { id: 'asc' }
        });

        return {
            data: products,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
    }

    static async getFilterOptions(utenteId: number) {
        const marchi = await prisma.masterFile.findMany({
            where: { utenteId, marchioId: { not: null } },
            distinct: ['marchioId'],
            select: { marchio: { select: { id: true, nome: true } } }
        });

        const categorie = await prisma.masterFile.findMany({
            where: { utenteId, categoriaId: { not: null } },
            distinct: ['categoriaId'],
            select: { categoria: { select: { id: true, nome: true } } }
        });

        const fornitori = await prisma.masterFile.findMany({
            where: { utenteId },
            distinct: ['fornitoreSelezionatoId'],
            select: { fornitoreSelezionato: { select: { id: true, nomeFornitore: true } } }
        });

        return {
            marchi: marchi.map(m => m.marchio).filter(Boolean),
            categorie: categorie.map(c => c.categoria).filter(Boolean),
            fornitori: fornitori.map(f => ({ id: f.fornitoreSelezionato.id, nome: f.fornitoreSelezionato.nomeFornitore }))
        };
    }
}
