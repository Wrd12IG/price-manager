import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ProductFilterService } from './ProductFilterService';
import { IcecatUtils } from '../utils/IcecatUtils';

/**
 * Servizio per la consolidazione del Master File.
 * 
 * Responsabilità:
 * 1. Consolidare prodotti da ListinoRaw in MasterFile
 * 2. Applicare filtri prodotti usando ProductFilterService
 * 3. Selezionare il miglior fornitore per ogni prodotto (prezzo + disponibilità)
 * 4. Gestire relazioni con Marchio e Categoria
 */
export class MasterFileService {

    /**
     * Consolida i prodotti da ListinoRaw in MasterFile applicando i filtri prodotti
     */
    static async consolidaMasterFile(): Promise<{
        totalRaw: number;
        filtered: number;
        consolidated: number;
        excluded: number;
    }> {
        logger.info('🔄 Inizio consolidamento Master File con applicazione filtri prodotti');

        const startTime = Date.now();
        const filterService = new ProductFilterService();

        try {
            // 1. Recupera tutti i prodotti raw
            const rawProducts = await prisma.listinoRaw.findMany({
                include: {
                    fornitore: true
                },
                orderBy: {
                    prezzoAcquisto: 'asc' // Ordina per prezzo per facilitare selezione best price
                }
            });

            logger.info(`📦 Trovati ${rawProducts.length} prodotti raw da elaborare`);

            if (rawProducts.length === 0) {
                logger.warn('⚠️ Nessun prodotto trovato in ListinoRaw');
                return {
                    totalRaw: 0,
                    filtered: 0,
                    consolidated: 0,
                    excluded: 0
                };
            }

            // 2. Applica filtri prodotti
            const { includedProducts, excludedProducts } = await this.applyProductFilters(
                rawProducts,
                filterService
            );

            logger.info(`✅ Prodotti inclusi dopo filtri: ${includedProducts.length}`);
            logger.info(`❌ Prodotti esclusi da filtri: ${excludedProducts.length}`);

            // 3. Raggruppa per EAN e seleziona miglior fornitore
            const consolidatedProducts = await this.consolidateByEAN(includedProducts);

            logger.info(`🎯 Prodotti consolidati: ${consolidatedProducts.length}`);

            // 4. Salva in MasterFile (sovrascrivi tutto)
            await this.saveMasterFile(consolidatedProducts);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`✨ Consolidamento completato in ${duration}s`);

            // 5. Applica regole di markup
            const { MarkupService } = await import('./MarkupService');
            await MarkupService.applicaRegolePrezzi();

            return {
                totalRaw: rawProducts.length,
                filtered: includedProducts.length,
                consolidated: consolidatedProducts.length,
                excluded: excludedProducts.length
            };

        } catch (error) {
            logger.error('❌ Errore durante consolidamento Master File:', error);
            throw error;
        }
    }

    /**
     * Applica i filtri prodotti usando ProductFilterService
     */
    private static async applyProductFilters(
        rawProducts: any[],
        filterService: ProductFilterService
    ): Promise<{
        includedProducts: any[];
        excludedProducts: any[];
    }> {
        const includedProducts: any[] = [];
        const excludedProducts: any[] = [];

        // Recupera le regole attive
        const activeRules = await filterService.getActiveRules();

        if (activeRules.length === 0) {
            logger.info('ℹ️ Nessun filtro attivo, tutti i prodotti saranno inclusi');
            return {
                includedProducts: rawProducts,
                excludedProducts: []
            };
        }

        logger.info(`🎯 Applicazione di ${activeRules.length} regole di filtro attive`);

        // Applica filtri
        for (const product of rawProducts) {
            const brand = product.marca || null;
            const category = product.categoriaFornitore || null;

            const filterResult = await filterService.evaluateRules(
                activeRules,
                brand,
                category
            );

            if (filterResult.shouldInclude) {
                includedProducts.push({
                    ...product,
                    _filterInfo: filterResult
                });
            } else {
                excludedProducts.push({
                    ...product,
                    _filterReason: filterResult.reason
                });
            }
        }

        return { includedProducts, excludedProducts };
    }

    /**
     * Raggruppa prodotti per EAN e seleziona il miglior fornitore
     * Criteri: 1) Prezzo più basso, 2) Maggiore disponibilità
     */
    private static async consolidateByEAN(products: any[]): Promise<any[]> {
        const groupedByEAN = new Map<string, any[]>();

        // Raggruppa per EAN
        for (const product of products) {
            const ean = product.eanGtin;
            if (!ean) continue;

            if (!groupedByEAN.has(ean)) {
                groupedByEAN.set(ean, []);
            }
            groupedByEAN.get(ean)!.push(product);
        }

        const consolidated: any[] = [];

        // Per ogni EAN, seleziona il miglior fornitore
        for (const [ean, variants] of groupedByEAN) {
            // Ordina per: 1) Prezzo ascendente, 2) Quantità discendente
            variants.sort((a, b) => {
                if (a.prezzoAcquisto !== b.prezzoAcquisto) {
                    return a.prezzoAcquisto - b.prezzoAcquisto;
                }
                return b.quantitaDisponibile - a.quantitaDisponibile;
            });

            const bestVariant = variants[0];

            // Aggiungi info su fornitori alternativi
            const alternativeSuppliers = variants.slice(1).map(v => ({
                fornitoreId: v.fornitoreId,
                fornitoreNome: v.fornitore?.nomeFornitore,
                prezzo: v.prezzoAcquisto,
                quantita: v.quantitaDisponibile
            }));

            // Calcola quantità totale sommando le disponibilità di tutti i fornitori
            const totalQuantity = variants.reduce((sum, v) => sum + v.quantitaDisponibile, 0);

            consolidated.push({
                ...bestVariant,
                _alternativeSuppliers: alternativeSuppliers,
                _totalSuppliers: variants.length,
                _totalQuantity: totalQuantity // Campo temporaneo per passare il totale
            });
        }

        return consolidated;
    }

    /**
     * Salva i prodotti consolidati in MasterFile
     */
    private static async saveMasterFile(products: any[]): Promise<void> {
        logger.info('💾 Salvataggio prodotti in MasterFile...');

        // 1. BACKUP DATI ICECAT ESISTENTI
        // Prima di cancellare il MasterFile (che ha delete cascade), salviamo i dati Icecat
        logger.info('📦 Backup dati Icecat esistenti...');
        const existingIcecatData = await prisma.datiIcecat.findMany();
        const icecatBackup = new Map<string, any>();

        for (const data of existingIcecatData) {
            if (data.eanGtin) {
                icecatBackup.set(data.eanGtin, data);
            }
        }
        logger.info(`📦 Backup completato per ${icecatBackup.size} prodotti arricchiti`);

        // 2. SVUOTA MASTERFILE (Questo cancellerà anche i record in DatiIcecat via cascade)
        await prisma.masterFile.deleteMany({});
        logger.info('🗑️ MasterFile svuotato');

        // 3. INSERISCI NUOVI PRODOTTI MASTERFILE
        const dataToInsert: any[] = [];

        for (const product of products) {
            try {
                // Trova o crea il marchio
                let marchioId: number | null = null;
                if (product.marca) {
                    const marchio = await prisma.marchio.upsert({
                        where: { nome: product.marca },
                        create: {
                            nome: product.marca,
                            normalizzato: product.marca.toUpperCase().trim(),
                            attivo: true
                        },
                        update: {}
                    });
                    marchioId = marchio.id;
                }

                // Trova o crea la categoria
                let categoriaId: number | null = null;
                if (product.categoriaFornitore) {
                    const categoria = await prisma.categoria.upsert({
                        where: { nome: product.categoriaFornitore },
                        create: {
                            nome: product.categoriaFornitore,
                            normalizzato: product.categoriaFornitore.toUpperCase().trim(),
                            attivo: true
                        },
                        update: {}
                    });
                    categoriaId = categoria.id;
                }

                dataToInsert.push({
                    eanGtin: product.eanGtin,
                    skuSelezionato: product.skuFornitore,
                    fornitoreSelezionatoId: product.fornitoreId,
                    prezzoAcquistoMigliore: product.prezzoAcquisto,
                    prezzoVenditaCalcolato: Math.ceil(product.prezzoAcquisto), // Arrotondato per eccesso senza decimali
                    quantitaTotaleAggregata: product._totalQuantity || product.quantitaDisponibile,
                    marchioId: marchioId,
                    categoriaId: categoriaId,
                    nomeProdotto: product.descrizioneOriginale
                });

            } catch (error) {
                logger.error(`Errore preparazione prodotto ${product.eanGtin}:`, error);
            }
        }

        // Inserimento batch MasterFile
        const batchSize = 500;
        let inserted = 0;

        for (let i = 0; i < dataToInsert.length; i += batchSize) {
            const batch = dataToInsert.slice(i, i + batchSize);
            await prisma.masterFile.createMany({
                data: batch
            });
            inserted += batch.length;

            if (inserted % 1000 === 0) {
                logger.info(`💾 Inseriti ${inserted}/${dataToInsert.length} prodotti...`);
            }
        }

        logger.info(`✅ ${inserted} prodotti salvati in MasterFile`);

        // 4. RIPRISTINO DATI ICECAT
        // Recuperiamo i nuovi ID del MasterFile appena creati
        if (icecatBackup.size > 0) {
            logger.info('♻️ Ripristino dati Icecat...');

            const newMasterFiles = await prisma.masterFile.findMany({
                select: { id: true, eanGtin: true }
            });

            const icecatToRestore: any[] = [];

            for (const mf of newMasterFiles) {
                const backup = icecatBackup.get(mf.eanGtin);
                if (backup) {
                    icecatToRestore.push({
                        masterFileId: mf.id,
                        eanGtin: mf.eanGtin,
                        descrizioneBrave: backup.descrizioneBrave,
                        descrizioneLunga: backup.descrizioneLunga,
                        specificheTecnicheJson: backup.specificheTecnicheJson,
                        urlImmaginiJson: backup.urlImmaginiJson,
                        bulletPointsJson: backup.bulletPointsJson,
                        documentiJson: backup.documentiJson,
                        linguaOriginale: backup.linguaOriginale,
                        dataScaricamento: backup.dataScaricamento
                    });
                }
            }

            if (icecatToRestore.length > 0) {
                // Insert in batches to be safe
                for (let i = 0; i < icecatToRestore.length; i += batchSize) {
                    const batch = icecatToRestore.slice(i, i + batchSize);
                    await prisma.datiIcecat.createMany({
                        data: batch
                    });
                }
                logger.info(`✅ Ripristinati dati Icecat per ${icecatToRestore.length} prodotti`);
            }
        }
    }

    /**
     * Ottiene statistiche sul Master File
     */
    static async getStats(): Promise<{
        totalProducts: number;
        bySupplier: Record<string, number>;
        byBrand: Record<string, number>;
        byCategory: Record<string, number>;
    }> {
        const products = await prisma.masterFile.findMany({
            include: {
                fornitoreSelezionato: true,
                marchio: true,
                categoria: true
            }
        });

        const stats = {
            totalProducts: products.length,
            bySupplier: {} as Record<string, number>,
            byBrand: {} as Record<string, number>,
            byCategory: {} as Record<string, number>
        };

        for (const p of products) {
            // Supplier stats
            const supplierName = p.fornitoreSelezionato?.nomeFornitore || 'Unknown';
            stats.bySupplier[supplierName] = (stats.bySupplier[supplierName] || 0) + 1;

            // Brand stats
            const brandName = p.marchio?.nome || 'Unknown';
            stats.byBrand[brandName] = (stats.byBrand[brandName] || 0) + 1;

            // Category stats
            const categoryName = p.categoria?.nome || 'Unknown';
            stats.byCategory[categoryName] = (stats.byCategory[categoryName] || 0) + 1;
        }

        return stats;
    }

    /**
     * Ottiene prodotti dal Master File con paginazione e ricerca
     * Include anche i dati di stock per fornitore
     */
    static async getMasterFile(
        page: number = 1,
        limit: number = 50,
        search: string = ''
    ): Promise<{
        data: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const skip = (page - 1) * limit;

        // Build where clause for search
        const where: any = {};
        if (search) {
            where.OR = [
                { eanGtin: { contains: search } },
                { skuSelezionato: { contains: search } },
                { marchio: { nome: { contains: search } } },
                { categoria: { nome: { contains: search } } }
            ];
        }

        // Get total count
        const total = await prisma.masterFile.count({ where });

        // Get paginated products
        const products = await prisma.masterFile.findMany({
            where,
            skip,
            take: limit,
            include: {
                fornitoreSelezionato: {
                    select: {
                        id: true,
                        nomeFornitore: true
                    }
                },
                marchio: {
                    select: {
                        id: true,
                        nome: true
                    }
                },
                categoria: {
                    select: {
                        id: true,
                        nome: true
                    }
                },
                datiIcecat: {
                    select: {
                        id: true,
                        urlImmaginiJson: true,
                        descrizioneBrave: true
                    }
                },
                outputShopify: {
                    select: {
                        id: true,
                        shopifyProductId: true,
                        title: true,
                        statoCaricamento: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Recupera lo stock per fornitore per tutti gli EAN di questa pagina
        const eans = products.map(p => p.eanGtin);

        const rawStockData = await prisma.listinoRaw.findMany({
            where: {
                eanGtin: { in: eans }
            },
            select: {
                eanGtin: true,
                quantitaDisponibile: true,
                prezzoAcquisto: true,
                fornitore: {
                    select: {
                        nomeFornitore: true
                    }
                }
            }
        });

        // Raggruppa stock per EAN
        const stockByEan = new Map<string, Array<{
            fornitore: string;
            quantita: number;
            prezzo: number;
        }>>();

        for (const raw of rawStockData) {
            if (!raw.eanGtin) continue;

            if (!stockByEan.has(raw.eanGtin)) {
                stockByEan.set(raw.eanGtin, []);
            }
            stockByEan.get(raw.eanGtin)!.push({
                fornitore: raw.fornitore.nomeFornitore,
                quantita: raw.quantitaDisponibile,
                prezzo: raw.prezzoAcquisto
            });
        }

        // Aggiungi stockPerFornitore a ogni prodotto
        const productsWithStock = products.map(p => ({
            ...p,
            stockPerFornitore: stockByEan.get(p.eanGtin) || []
        }));

        return {
            data: productsWithStock,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
