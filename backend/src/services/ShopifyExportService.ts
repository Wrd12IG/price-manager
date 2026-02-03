// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AIMetafieldService } from './AIMetafieldService';

export class ShopifyExportService {

    /**
     * Genera una tabella HTML formattata dalle specifiche tecniche
     */
    private static generateSpecsTable(specs: any): string | null {
        if (!specs || (Array.isArray(specs) && specs.length === 0)) {
            logger.debug('generateSpecsTable: specs vuoto o null');
            return null;
        }

        const specsList = Array.isArray(specs) ? specs : Object.entries(specs).map(([name, value]) => ({ name, value }));

        if (specsList.length === 0) {
            logger.debug('generateSpecsTable: specsList vuoto dopo conversione');
            return null;
        }

        let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
        let rowsAdded = 0;

        for (const spec of specsList) {
            const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
            const value = spec.value || spec.PresentationValue || '';

            if (!name || !value) {
                // Log solo le prime 3 per non spammare
                if (rowsAdded < 3) {
                    logger.debug(`generateSpecsTable: Skip spec - name='${name}', value='${String(value).substring(0, 30)}'`);
                }
                continue;
            }

            rowsAdded++;
            tableHtml += `<tr>`;
            tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${this.escapeHtml(name)}</strong></td>`;
            tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${this.escapeHtml(String(value))}</td>`;
            tableHtml += `</tr>`;
        }

        tableHtml += '</table>';

        logger.debug(`generateSpecsTable: Generata tabella con ${rowsAdded} righe (${tableHtml.length} char) da ${specsList.length} specs`);

        return tableHtml;
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
     * Genera record per export Shopify per un utente
     */
    static async generateExport(utenteId: number): Promise<any[]> {
        logger.info(`📤 [Utente ${utenteId}] Generazione dati export Shopify`);

        // 1. Prendi tutti i prodotti nel MasterFile CON i dati ICECAT
        const products = await prisma.masterFile.findMany({
            where: { utenteId },
            include: {
                marchio: { select: { nome: true } },
                categoria: { select: { nome: true } },
                outputShopify: { select: { id: true } },
                datiIcecat: true  // IMPORTANTE: Include i dati ICECAT per le immagini
            }
        });

        logger.info(`📊 [Utente ${utenteId}] Analisi ${products.length} prodotti per export`);

        // 2. Filtra quelli che non hanno ancora un record di output
        const missingOutputs = products.filter(p => !p.outputShopify);

        if (missingOutputs.length > 0) {
            logger.info(`🆕 [Utente ${utenteId}] Creazione di ${missingOutputs.length} nuovi record di output`);

            const dataToCreate = missingOutputs.map(p => {
                // ✅ FIX EUROPC: Usa ICECAT quando nomeProdotto è null
                let title = p.nomeProdotto;
                let vendor = p.marchio?.nome || 'Generico';

                // Se nomeProdotto è null o vendor è '4711' (errore import), usa ICECAT
                if (!title || !p.nomeProdotto) {
                    if (p.datiIcecat?.descrizioneBrave) {
                        title = p.datiIcecat.descrizioneBrave;
                        // Estrai vendor dal primo token della descrizione ICECAT
                        const firstWord = title.split(' ')[0];
                        if (firstWord && firstWord.length > 2) {
                            vendor = firstWord;
                        }
                    } else {
                        title = `Prodotto ${p.eanGtin}`;
                    }
                }

                // Fix vendor '4711' (prefisso EAN erroneamente usato come marca)
                if (vendor === '4711' && p.datiIcecat?.descrizioneBrave) {
                    const firstWord = p.datiIcecat.descrizioneBrave.split(' ')[0];
                    if (firstWord && firstWord.length > 2) {
                        vendor = firstWord;
                    }
                }

                // Estrai le immagini da ICECAT se disponibili
                let immaginiUrls: string | null = null;
                let descrizioneBreve: string | null = null;
                let specificheJson: string | null = null;
                let bodyHtml = `<p>${title}</p>`;

                if (p.datiIcecat) {
                    // Usa le immagini da ICECAT
                    if (p.datiIcecat.urlImmaginiJson) {
                        immaginiUrls = p.datiIcecat.urlImmaginiJson;
                        logger.debug(`🖼️ Prodotto ${p.eanGtin}: ${JSON.parse(p.datiIcecat.urlImmaginiJson).length} immagini da ICECAT`);
                    }

                    // Usa la descrizione breve da ICECAT
                    if (p.datiIcecat.descrizioneBrave) {
                        descrizioneBreve = p.datiIcecat.descrizioneBrave;
                    }

                    // Usa la descrizione lunga da ICECAT per il body HTML
                    if (p.datiIcecat.descrizioneLunga) {
                        bodyHtml = `<div class="product-description">${p.datiIcecat.descrizioneLunga}</div>`;
                    }

                    // Usa le specifiche tecniche da ICECAT
                    if (p.datiIcecat.specificheTecnicheJson) {
                        specificheJson = p.datiIcecat.specificheTecnicheJson;
                    }
                }

                // 📝 GENERA METAFIELDS da ICECAT e dati prodotto
                let metafieldsObj: Record<string, string> = {};

                if (p.datiIcecat) {
                    // Metafields base
                    if (p.eanGtin) {
                        metafieldsObj['custom.ean'] = p.eanGtin;
                    }
                    // ✅ USA IL VENDOR CORRETTO (non p.marchio che può essere '4711')
                    metafieldsObj['custom.marca'] = vendor;

                    if (p.categoria?.nome) {
                        metafieldsObj['custom.categoria_prodotto'] = p.categoria.nome;
                    }

                    // Disponibilità
                    if (p.quantitaTotaleAggregata > 0) {
                        metafieldsObj['custom.info_disponibilita'] = `${p.quantitaTotaleAggregata} unità disponibili`;
                    }

                    // Descrizioni
                    if (p.datiIcecat.descrizioneBrave) {
                        metafieldsObj['custom.descrizione_breve'] = p.datiIcecat.descrizioneBrave;
                    }
                    if (p.datiIcecat.descrizioneLunga) {
                        metafieldsObj['custom.descrizione_lunga'] = p.datiIcecat.descrizioneLunga;
                    }

                    // Specifiche tecniche - parsing JSON
                    if (p.datiIcecat.specificheTecnicheJson) {
                        try {
                            const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);

                            // Mappa le specifiche tecniche comuni
                            const specsMap: Record<string, string> = {
                                'processore': 'custom.processore_brand',
                                'processor': 'custom.processore_brand',
                                'cpu': 'custom.processore_brand',
                                'ram': 'custom.ram',
                                'memoria': 'custom.ram',
                                'memory': 'custom.ram',
                                'storage': 'custom.capacita_ssd',
                                'ssd': 'custom.capacita_ssd',
                                'hard disk': 'custom.capacita_ssd',
                                'display': 'custom.dimensione_monitor',
                                'schermo': 'custom.dimensione_monitor',
                                'screen': 'custom.dimensione_monitor',
                                'sistema operativo': 'custom.sistema_operativo',
                                'os': 'custom.sistema_operativo',
                                'operating system': 'custom.sistema_operativo',
                                'gpu': 'custom.scheda_video',
                                'scheda grafica': 'custom.scheda_video',
                                'graphics': 'custom.scheda_video',
                                'risoluzione': 'custom.risoluzione_monitor',
                                'resolution': 'custom.risoluzione_monitor',
                            };

                            // Estrai le specifiche (supporta sia array che oggetto)
                            const specsList = Array.isArray(specs) ? specs : Object.entries(specs);

                            for (const spec of specsList) {
                                const [key, value] = Array.isArray(spec) ? spec : [spec.name || spec.key, spec.value];
                                if (!value) continue;

                                const keyLower = String(key).toLowerCase();
                                const metafieldKey = specsMap[keyLower];

                                if (metafieldKey && !metafieldsObj[metafieldKey]) {
                                    metafieldsObj[metafieldKey] = String(value);
                                }
                            }

                            // ✅ GENERA TABELLA HTML FORMATTATA dalle specifiche
                            const tableHtml = this.generateSpecsTable(specs);
                            if (tableHtml) {
                                metafieldsObj['custom.tabella_specifiche'] = tableHtml;
                            }
                        } catch (e) {
                            logger.error(`Errore parsing specifiche tecniche per ${p.eanGtin}:`, e);
                        }
                    }

                    // Bullet points
                    if (p.datiIcecat.bulletPointsJson) {
                        try {
                            const bullets = JSON.parse(p.datiIcecat.bulletPointsJson);
                            if (Array.isArray(bullets) && bullets.length > 0) {
                                metafieldsObj['custom.punti_chiave'] = bullets.join(' • ');
                            }
                        } catch (e) {
                            logger.debug(`Errore parsing bullet points per ${p.eanGtin}`);
                        }
                    }

                    // Documenti (es. PDF scheda tecnica)
                    if (p.datiIcecat.documentiJson) {
                        try {
                            const docs = JSON.parse(p.datiIcecat.documentiJson);
                            if (Array.isArray(docs) && docs.length > 0 && docs[0].url) {
                                metafieldsObj['custom.scheda_pdf'] = docs[0].url;
                            }
                        } catch (e) {
                            logger.debug(`Errore parsing documenti per ${p.eanGtin}`);
                        }
                    }
                }

                return {
                    utenteId,
                    masterFileId: p.id,
                    handle: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.id}`,
                    title: title,
                    bodyHtml: bodyHtml,
                    vendor: vendor,  // ✅ USA IL VENDOR CORRETTO (non p.marchio che può essere '4711')
                    productType: p.categoria?.nome || 'Hardware',
                    sku: p.partNumber || `SKU-${p.id}`,
                    barcode: p.eanGtin,
                    variantPrice: p.prezzoVenditaCalcolato || 0,
                    variantInventoryQty: p.quantitaTotaleAggregata || 0,
                    immaginiUrls: immaginiUrls,          // Immagini da ICECAT
                    descrizioneBreve: descrizioneBreve,   // Descrizione breve da ICECAT
                    specificheJson: specificheJson,       // Specifiche tecniche da ICECAT
                    metafieldsJson: Object.keys(metafieldsObj).length > 0 ? JSON.stringify(metafieldsObj) : null,  // ✅ METAFIELDS!
                    statoCaricamento: 'pending'
                };
            });

            // Inserimento in batch
            const batchSize = 500;
            for (let i = 0; i < dataToCreate.length; i += batchSize) {
                const batch = dataToCreate.slice(i, i + batchSize);
                await prisma.outputShopify.createMany({
                    data: batch,
                    skipDuplicates: true
                });
                logger.info(`✅ [Utente ${utenteId}] Batch export ${i + batch.length}/${dataToCreate.length} completato`);
            }

            // Log quanti prodotti hanno immagini
            const productsWithImages = dataToCreate.filter(d => d.immaginiUrls).length;
            logger.info(`🖼️ [Utente ${utenteId}] ${productsWithImages}/${dataToCreate.length} prodotti con immagini da ICECAT`);

            // 🤖 AI FALLBACK: Arricchisci prodotti senza tabella specifiche
            logger.info(`\n🤖 [Utente ${utenteId}] Avvio AI Fallback per prodotti senza specifiche...`);

            const productsNeedingAI = await prisma.outputShopify.findMany({
                where: {
                    utenteId,
                    OR: [
                        { metafieldsJson: null },
                        { metafieldsJson: { not: { contains: 'custom.tabella_specifiche' } } }
                    ]
                },
                include: {
                    masterFile: {
                        include: {
                            datiIcecat: true,
                            marchio: true,
                            categoria: true
                        }
                    }
                }
            });

            if (productsNeedingAI.length > 0) {
                logger.info(`   📋 Trovati ${productsNeedingAI.length} prodotti da arricchire con AI`);

                let aiSuccess = 0;
                let aiFailed = 0;

                for (const product of productsNeedingAI) {
                    try {
                        logger.info(`   🤖 AI per ${product.masterFile.eanGtin || product.title.substring(0, 40)}...`);

                        const aiMetafields = await AIMetafieldService.generateMetafields(
                            utenteId,
                            product.masterFile
                        );

                        if (aiMetafields && Object.keys(aiMetafields).length > 0) {
                            // Merge con metafields esistenti
                            const existingMeta = product.metafieldsJson
                                ? JSON.parse(product.metafieldsJson)
                                : {};

                            const mergedMeta = { ...existingMeta, ...aiMetafields };

                            // Aggiorna il record (con gestione record mancanti)
                            try {
                                await prisma.outputShopify.update({
                                    where: { id: product.id },
                                    data: {
                                        metafieldsJson: JSON.stringify(mergedMeta)
                                    }
                                });

                                aiSuccess++;
                                logger.info(`      ✅ ${Object.keys(aiMetafields).length} metafields generati`);
                            } catch (updateError: any) {
                                // P2025 = Record to update not found (record eliminato durante il processo)
                                if (updateError.code === 'P2025') {
                                    logger.warn(`      ⚠️ Record ${product.id} non trovato (eliminato), skip AI update`);
                                    // Non incrementare aiFailed - è un caso normale
                                } else {
                                    // Altri errori sono critici
                                    aiFailed++;
                                    logger.error(`      ❌ Errore update record ${product.id}: ${updateError.message}`);
                                }
                            }
                        } else {
                            aiFailed++;
                            logger.warn(`      ⚠️ AI non ha generato metafields`);
                        }
                    } catch (error: any) {
                        aiFailed++;
                        logger.error(`      ❌ Errore AI: ${error.message}`);
                    }
                }

                logger.info(`\n   ✅ AI Fallback completato: ${aiSuccess} successi, ${aiFailed} fallimenti`);
            } else {
                logger.info(`   ✅ Nessun prodotto richiede AI fallback`);
            }
        }

        // 3. Ritorna tutti i record di output per questo utente
        return await prisma.outputShopify.findMany({
            where: { utenteId }
        });
    }

    /**
     * Aggiorna i record OutputShopify esistenti con i dati ICECAT mancanti
     * (per i prodotti che sono stati creati PRIMA dell'arricchimento ICECAT)
     */
    static async updateExistingWithIcecatData(utenteId: number): Promise<{ updated: number; total: number }> {
        logger.info(`🔄 [Utente ${utenteId}] Aggiornamento record esistenti con dati ICECAT`);

        // Trova tutti i prodotti con dati ICECAT ma senza immagini in OutputShopify
        const productsToUpdate = await prisma.outputShopify.findMany({
            where: {
                utenteId,
                immaginiUrls: null,  // Senza immagini
                masterFile: {
                    datiIcecat: {
                        urlImmaginiJson: { not: null }  // Ma hanno dati ICECAT
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

        logger.info(`📊 [Utente ${utenteId}] Trovati ${productsToUpdate.length} prodotti da aggiornare con dati ICECAT`);

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

        logger.info(`✅ [Utente ${utenteId}] Aggiornati ${updated} prodotti con dati ICECAT`);
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
