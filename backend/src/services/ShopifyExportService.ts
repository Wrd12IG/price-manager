// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AIMetafieldService } from './AIMetafieldService';
import { EnhancedMetafieldService } from './EnhancedMetafieldService';
import { jobProgressManager } from './JobProgressService';

export class ShopifyExportService {

    /**
     * Genera una tabella HTML formattata dalle specifiche tecniche
     */
    private static generateSpecsTable(specs: any): string | null {
        if (!specs || (Array.isArray(specs) && specs.length === 0)) {
            return null;
        }

        const specsList = Array.isArray(specs) ? specs : Object.entries(specs).map(([name, value]) => ({ name, value }));

        if (specsList.length === 0) return null;

        let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
        let rowsAdded = 0;

        for (const spec of specsList) {
            const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
            const value = spec.value || spec.PresentationValue || '';

            if (!name || !value) continue;

            rowsAdded++;
            tableHtml += `<tr>`;
            tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${this.escapeHtml(name)}</strong></td>`;
            tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${this.escapeHtml(String(value))}</td>`;
            tableHtml += `</tr>`;
        }

        tableHtml += '</table>';
        return rowsAdded > 0 ? tableHtml : null;
    }

    /**
     * Escape HTML per sicurezza
     */
    private static escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * 🗂️ Risolve la categoria interna nel productType Shopify
     * tramite la mappatura configurata in ConfigurazioneSistema.
     */
    private static async resolveProductType(utenteId: number, categoriaInterna: string): Promise<string> {
        try {
            const cfg = await prisma.configurazioneSistema.findFirst({
                where: { utenteId, chiave: 'shopify_category_mapping' }
            });
            if (cfg?.valore) {
                const mapping: Record<string, string> = JSON.parse(cfg.valore);
                if (mapping[categoriaInterna]) return mapping[categoriaInterna];
                // Cerca case-insensitive
                const key = Object.keys(mapping).find(k => k.toLowerCase() === categoriaInterna.toLowerCase());
                if (key) return mapping[key];
            }
        } catch (_) { }
        return categoriaInterna; // Fallback: usa il nome categoria originale
    }

    /**
     * Genera record per export Shopify per un utente
     */
    static async generateExport(utenteId: number, jobId?: string): Promise<any[]> {
        logger.info(`📤 [Utente ${utenteId}] Generazione dati export Shopify`);

        // 1. Prendi tutti i prodotti nel MasterFile CON i dati ICECAT
        const products = await prisma.masterFile.findMany({
            where: { utenteId },
            include: {
                marchio: { select: { nome: true } },
                categoria: { select: { nome: true } },
                outputShopify: { select: { id: true, metafieldsJson: true, statoCaricamento: true, shopifyProductId: true } },
                datiIcecat: true
            }
        });

        logger.info(`📊 [Utente ${utenteId}] Analisi ${products.length} prodotti per export`);

        // ─────────────────────────────────────────────────────────────
        // 2a. PRODOTTI GIÀ CARICATI SU SHOPIFY → aggiorna SOLO prezzo e disponibilità
        //     NON rimettere a 'pending', altrimenti il sync li ricrea come nuovi prodotti (duplicati!)
        // ─────────────────────────────────────────────────────────────
        const alreadyUploaded = products.filter(p =>
            p.outputShopify && (p.outputShopify as any).statoCaricamento === 'uploaded'
        );

        if (alreadyUploaded.length > 0) {
            logger.info(`🔄 [Utente ${utenteId}] Aggiornamento prezzo/qty per ${alreadyUploaded.length} prodotti già su Shopify...`);
            let updatedPriceCount = 0;
            for (const p of alreadyUploaded) {
                const newPrice = p.prezzoVenditaCalcolato || 0;
                const newQty = p.quantitaTotaleAggregata || 0;
                await prisma.outputShopify.update({
                    where: { masterFileId: p.id },
                    data: {
                        variantPrice: newPrice,
                        variantInventoryQty: newQty,
                        // Segna come 'price_update' così syncProducts invia un PUT a Shopify
                        // senza creare un nuovo prodotto (NON 'pending', che causerebbe un POST!)
                        statoCaricamento: 'price_update'
                    }
                });
                updatedPriceCount++;
            }
            logger.info(`✅ Segnati ${updatedPriceCount} prodotti esistenti per aggiornamento prezzo/qty su Shopify`);
        }

        // ─────────────────────────────────────────────────────────────
        // 2b. PRODOTTI NUOVI (nessun record outputShopify) o
        //     PRODOTTI IN PENDING con tabella spec corta → riprocess completo
        // ─────────────────────────────────────────────────────────────
        const productsNeedingExport = products.filter(p => {
            // Nessun record ancora: serve creazione completa
            if (!p.outputShopify) return true;

            const stato = (p.outputShopify as any).statoCaricamento;

            // Già caricato su Shopify: gestito nel blocco sopra, non riprocessare
            if (stato === 'uploaded') return false;

            // ⚠️ In attesa di aggiornamento prezzo/qty: NON resettare a 'pending'!
            // Altrimenti il sync farà una POST (nuovo prodotto) invece di PUT (aggiornamento) → DUPLICATO!
            if (stato === 'price_update') return false;

            // Prodotto in blacklist: non toccare mai
            if (stato === 'blacklisted') return false;

            // Prodotto in pending o in errore: rigenera solo se la tabella spec è corta/assente
            const meta = p.outputShopify.metafieldsJson ? JSON.parse(p.outputShopify.metafieldsJson) : {};
            const tableLen = meta['custom.tabella_specifiche']?.length || 0;
            return tableLen < 100;
        });

        if (productsNeedingExport.length > 0) {
            logger.info(`🆕 [Utente ${utenteId}] Processamento di ${productsNeedingExport.length} record di output (nuovi o da aggiornare)`);

            let processedCount = 0;
            const totalToProcess = productsNeedingExport.length;

            for (const p of productsNeedingExport) {
                processedCount++;

                // Aggiorna progress se jobId è presente (ogni 5 prodotti o alla fine)
                if (jobId && (processedCount % 5 === 0 || processedCount === totalToProcess)) {
                    const progress = Math.round((processedCount / totalToProcess) * 40); // 40% max per la fase di preparazione
                    jobProgressManager.updateProgress(jobId, progress, `Generazione export: ${processedCount}/${totalToProcess} prodotti...`);
                }
                let title = p.nomeProdotto;
                let vendor = p.marchio?.nome || 'Generico';

                if (!title) {
                    title = p.datiIcecat?.descrizioneBrave || `Prodotto ${p.eanGtin}`;
                }

                let immaginiUrls = p.datiIcecat?.urlImmaginiJson || null;
                let descrizioneBreve = p.datiIcecat?.descrizioneBrave || null;
                let bodyHtml = p.datiIcecat?.descrizioneLunga ? `<div class="product-description">${p.datiIcecat.descrizioneLunga}</div>` : `<p>${title}</p>`;
                let specificheJson = p.datiIcecat?.specificheTecnicheJson || null;

                // 🚀 USA IL NUOVO SERVIZIO AVANZATO PER GENERARE METAFIELDS COMPLETI
                logger.info(`🔧 Generazione metafields avanzati per: ${p.eanGtin}`);

                let metafieldsObj: Record<string, string> = {};

                try {
                    metafieldsObj = await EnhancedMetafieldService.generateCompleteMetafields(
                        utenteId,
                        {
                            id: p.id,
                            eanGtin: p.eanGtin,
                            partNumber: p.partNumber,
                            nomeProdotto: p.nomeProdotto,
                            marchio: p.marchio,
                            categoria: p.categoria,
                            datiIcecat: p.datiIcecat
                        }
                    );

                    logger.info(`✅ Generati ${Object.keys(metafieldsObj).length} metafields per ${p.eanGtin}`);

                } catch (error: any) {
                    logger.error(`❌ Errore generazione metafields avanzati per ${p.eanGtin}:`, error.message);

                    // FALLBACK: Genera metafields base da ICECAT se disponibile
                    if (p.eanGtin) metafieldsObj['custom.ean'] = p.eanGtin;
                    metafieldsObj['custom.marca'] = vendor;
                    if (p.categoria?.nome) metafieldsObj['custom.categoria_prodotto'] = p.categoria.nome;
                    if (p.quantitaTotaleAggregata > 0) metafieldsObj['custom.info_disponibilita'] = `${p.quantitaTotaleAggregata} unità disponibili`;
                    if (descrizioneBreve) metafieldsObj['custom.descrizione_breve'] = descrizioneBreve;
                    if (p.datiIcecat?.descrizioneLunga) metafieldsObj['custom.descrizione_lunga'] = p.datiIcecat.descrizioneLunga;

                    if (specificheJson) {
                        try {
                            const specs = JSON.parse(specificheJson);
                            const tableHtml = this.generateSpecsTable(specs);
                            if (tableHtml) metafieldsObj['custom.tabella_specifiche'] = tableHtml;
                        } catch (e) {
                            logger.warn(`Errore parsing specifiche per ${p.eanGtin}`);
                        }
                    }
                }

                const outputData = {
                    utenteId,
                    masterFileId: p.id,
                    handle: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.id}`,
                    title: title,
                    bodyHtml: bodyHtml,
                    vendor: vendor,
                    productType: await this.resolveProductType(utenteId, p.categoria?.nome || 'Hardware'),
                    sku: p.partNumber || `SKU-${p.id}`,
                    barcode: p.eanGtin,
                    variantPrice: p.prezzoVenditaCalcolato || 0,
                    variantInventoryQty: p.quantitaTotaleAggregata || 0,
                    immaginiUrls,
                    descrizioneBreve,
                    specificheJson,
                    metafieldsJson: JSON.stringify(metafieldsObj),
                    statoCaricamento: 'pending'
                };

                // Upsert solo per prodotti NON ancora caricati su Shopify
                // (quelli 'uploaded' sono stati già gestiti sopra con solo prezzo/qty)
                await prisma.outputShopify.upsert({
                    where: { masterFileId: p.id },
                    update: outputData,
                    create: outputData
                });
            }
        }

        logger.info(`✅ [Utente ${utenteId}] Dati export Shopify preparati`);

        // 🤖 AI FALLBACK: Arricchisci prodotti senza tabella specifiche o con tabella troppo corta
        logger.info(`\n🤖 [Utente ${utenteId}] Avvio AI Fallback per prodotti senza specifiche...`);

        const productsNeedingAI = await prisma.outputShopify.findMany({
            where: {
                utenteId,
                isAiEnriched: false
            },
            include: {
                masterFile: {
                    include: {
                        datiIcecat: true,
                        marchio: true,
                        categoria: true
                    }
                }
            },
            take: 20
        });

        // Filtriamo e aggiorniamo istantaneamente i prodotti che NON necessitano di AI
        const filteredNeedsAI = [];
        for (const p of productsNeedingAI) {
            let needsAi = true;
            if (p.metafieldsJson) {
                try {
                    const meta = JSON.parse(p.metafieldsJson);
                    const table = meta['custom.tabella_specifiche'] || '';
                    if (table.length >= 100) needsAi = false;
                } catch (e) { }
            }

            if (!needsAi) {
                // Il prodotto ha già specifiche lunghe valide, lo tiriamo fuori dalla coda a costo zero
                await prisma.outputShopify.update({
                    where: { id: p.id },
                    data: { isAiEnriched: true }
                });
            } else {
                filteredNeedsAI.push(p);
            }
        }

        if (filteredNeedsAI.length > 0) {
            logger.info(`   📋 Trovati ${filteredNeedsAI.length} prodotti da arricchire con AI`);

            for (const product of filteredNeedsAI) {
                try {
                    logger.info(`   🤖 AI per ${product.masterFile?.eanGtin || product.title.substring(0, 40)}...`);

                    const aiMetafields = await AIMetafieldService.generateMetafields(
                        utenteId,
                        {
                            id: product.masterFileId,
                            nomeProdotto: product.title,
                            marca: product.vendor,
                            categoriaEcommerce: product.productType,
                            datiIcecat: product.masterFile?.datiIcecat
                        }
                    );

                    if (aiMetafields && Object.keys(aiMetafields).length > 0) {
                        const existingMeta = product.metafieldsJson ? JSON.parse(product.metafieldsJson) : {};
                        const mergedMeta = { ...existingMeta, ...aiMetafields };

                        // ⚠️ Non resettare a 'pending' se è già 'uploaded' (evita duplicati!)
                        const updateData: any = {
                            metafieldsJson: JSON.stringify(mergedMeta),
                            isAiEnriched: true // Segnato correttamente!
                        };

                        // Sostituisce il titolo tecnico originale col nuovo titolo SEO se generato dall'AI,
                        // ma SOLO SE il prodotto non è già stato caricato su Shopify (evita sovrascritture di titoli custom dati dall'utente in Shopify)
                        if (aiMetafields['seo.titolo_ottimizzato'] && product.statoCaricamento !== 'uploaded') {
                            updateData.title = aiMetafields['seo.titolo_ottimizzato'].substring(0, 255);
                        }

                        if (product.statoCaricamento !== 'uploaded') {
                            updateData.statoCaricamento = 'pending';
                        }

                        await prisma.outputShopify.update({
                            where: { id: product.id },
                            data: updateData
                        });
                        logger.info(`      ✅ Dati generati con AI`);
                    } else {
                        logger.warn(`      ⚠️ AI non ha generato metafields`);
                        // Segnamo a true per non rimanerci bloccati per l'eternità
                        await prisma.outputShopify.update({
                            where: { id: product.id },
                            data: { isAiEnriched: true }
                        });
                    }
                } catch (error: any) {
                    logger.error(`      ❌ Errore AI: ${error.message}`);
                    await prisma.outputShopify.update({
                        where: { id: product.id },
                        data: { isAiEnriched: true }
                    });
                }
            }
        }

        return await prisma.outputShopify.findMany({
            where: { utenteId }
        });
    }

    /**
     * Aggiorna i record OutputShopify esistenti con i dati ICECAT mancanti
     */
    static async updateExistingWithIcecatData(utenteId: number): Promise<{ updated: number; total: number }> {
        logger.info(`🔄 [Utente ${utenteId}] Aggiornamento record esistenti con dati ICECAT`);

        const productsToUpdate = await prisma.outputShopify.findMany({
            where: {
                utenteId,
                immaginiUrls: null,
                masterFile: {
                    datiIcecat: {
                        urlImmaginiJson: { not: null }
                    }
                }
            },
            include: {
                masterFile: {
                    include: {
                        datiIcecat: true
                    }
                }
            }
        });

        let updated = 0;
        for (const output of productsToUpdate) {
            const icecat = output.masterFile?.datiIcecat;
            if (!icecat) continue;

            try {
                await prisma.outputShopify.update({
                    where: { id: output.id },
                    data: {
                        immaginiUrls: icecat.urlImmaginiJson,
                        descrizioneBreve: icecat.descrizioneBrave,
                        specificheJson: icecat.specificheTecnicheJson,
                        bodyHtml: icecat.descrizioneLunga
                            ? `<div class="product-description">${icecat.descrizioneLunga}</div>`
                            : output.bodyHtml
                    }
                });
                updated++;
            } catch (error) {
                logger.error(`❌ Errore aggiornamento prodotto ${output.id}: ${error}`);
            }
        }

        return { updated, total: productsToUpdate.length };
    }

    static async getStats(utenteId: number) {
        const total = await prisma.outputShopify.count({ where: { utenteId } });
        const uploaded = await prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'uploaded' } });
        const errors = await prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'error' } });

        return { total, uploaded, errors, ready: total - uploaded - errors };
    }

    static async getExportedProducts(utenteId: number, page: number = 1, limit: number = 50) {
        const skip = (page - 1) * limit;
        const [total, data] = await Promise.all([
            prisma.outputShopify.count({ where: { utenteId } }),
            prisma.outputShopify.findMany({
                where: { utenteId },
                skip, take: limit,
                orderBy: { updatedAt: 'desc' }
            })
        ]);

        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }
}
