import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ShopifyService } from './ShopifyService';
import { EnhancedMetafieldService } from './EnhancedMetafieldService';

export class ManualProductService {
    /**
     * Crea un prodotto nel master file e lo prepara per l'export su Shopify
     */
    static async createAndPrepare(utenteId: number, data: any) {
        const { ean, nome, marca, categoria, descrizione, specifiche, immagini, prezzo, quantita } = data;

        // 1. Trova o crea il fornitore "MANUALE"
        let manualSupplier = await prisma.fornitore.findFirst({
            where: { utenteId, nomeFornitore: 'MANUALE' }
        });

        if (!manualSupplier) {
            manualSupplier = await prisma.fornitore.create({
                data: {
                    utenteId,
                    nomeFornitore: 'MANUALE',
                    formatoFile: 'manual',
                    tipoAccesso: 'manual',
                    attivo: true
                }
            });
        }

        // 2. Trova o crea Marchio
        let marchioId: number | null = null;
        const marcaNome = marca?.trim();
        if (marcaNome) {
            let m = await prisma.marchio.findFirst({
                where: {
                    OR: [
                        { nome: { equals: marcaNome, mode: 'insensitive' } },
                        { normalizzato: marcaNome.toUpperCase() }
                    ]
                }
            });

            if (!m) {
                m = await prisma.marchio.create({
                    data: { nome: marcaNome, normalizzato: marcaNome.toUpperCase() }
                });
            }
            marchioId = m.id;
        }

        // 2b. Trova o crea Categoria
        let categoriaId: number | null = null;
        const catNome = categoria?.trim();
        if (catNome) {
            let c = await prisma.categoria.findFirst({
                where: {
                    OR: [
                        { nome: { equals: catNome, mode: 'insensitive' } },
                        { normalizzato: catNome.toUpperCase() }
                    ]
                }
            });

            if (!c) {
                c = await prisma.categoria.create({
                    data: { nome: catNome, normalizzato: catNome.toUpperCase() }
                });
            }
            categoriaId = c.id;
        }

        // 3. Crea record nel MasterFile
        const skuSelezionato = `${ean}BTO`;

        const masterFile = await prisma.masterFile.upsert({
            where: { utenteId_eanGtin: { utenteId, eanGtin: ean } },
            update: {
                nomeProdotto: nome,
                marchioId,
                categoriaId,
                prezzoAcquistoMigliore: prezzo || 0,
                prezzoVenditaCalcolato: prezzo || 0,
                quantitaTotaleAggregata: quantita || 0,
                fornitoreSelezionatoId: manualSupplier.id,
                updatedAt: new Date()
            },
            create: {
                utenteId,
                eanGtin: ean,
                skuSelezionato,
                nomeProdotto: nome,
                marchioId,
                categoriaId,
                prezzoAcquistoMigliore: prezzo || 0,
                prezzoVenditaCalcolato: prezzo || 0,
                quantitaTotaleAggregata: quantita || 0,
                fornitoreSelezionatoId: manualSupplier.id
            }
        });

        // 4. Salva dati Icecat (se forniti)
        if (descrizione || specifiche || immagini) {
            await prisma.datiIcecat.upsert({
                where: { masterFileId: masterFile.id },
                create: {
                    masterFileId: masterFile.id,
                    eanGtin: ean,
                    descrizioneBrave: descrizione?.substring(0, 200) || '',
                    descrizioneLunga: descrizione || '',
                    specificheTecnicheJson: JSON.stringify(specifiche || []),
                    urlImmaginiJson: JSON.stringify(immagini || []),
                    bulletPointsJson: JSON.stringify((specifiche || []).slice(0, 5).map((f: any) => `${f.name}: ${f.value}`))
                },
                update: {
                    descrizioneBrave: descrizione?.substring(0, 200) || '',
                    descrizioneLunga: descrizione || '',
                    specificheTecnicheJson: JSON.stringify(specifiche || []),
                    urlImmaginiJson: JSON.stringify(immagini || []),
                    bulletPointsJson: JSON.stringify((specifiche || []).slice(0, 5).map((f: any) => `${f.name}: ${f.value}`))
                }
            });
        }

        // 5. Genera i Metafields strutturati
        let metafieldsJson = '{}';
        try {
            const metafieldsObj = await EnhancedMetafieldService.generateCompleteMetafields(
                utenteId,
                {
                    id: masterFile.id,
                    eanGtin: ean,
                    nomeProdotto: nome,
                    marchio: { nome: marca || 'Generico' },
                    categoria: { nome: categoria || 'Manuale' },
                    datiIcecat: {
                        descrizioneBrave: descrizione?.substring(0, 200) || '',
                        descrizioneLunga: descrizione || '',
                        specificheTecnicheJson: JSON.stringify(specifiche || []),
                        urlImmaginiJson: JSON.stringify(immagini || [])
                    }
                }
            );
            metafieldsJson = JSON.stringify(metafieldsObj);
            logger.info(`✅ Metafields generati per prodotto BTO: ${ean}`);
        } catch (error) {
            logger.error(`❌ Errore generazione metafields per BTO ${ean}:`, error);
        }

        // 6. Crea record OutputShopify per permettere il push
        const handle = nome ? nome.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `prodotto-${ean}`;

        const output = await prisma.outputShopify.upsert({
            where: { masterFileId: masterFile.id },
            create: {
                utenteId,
                masterFileId: masterFile.id,
                handle,
                title: nome || `Prodotto ${ean}`,
                bodyHtml: descrizione || '',
                vendor: marca || 'Generico',
                productType: categoria || 'Manuale',
                sku: skuSelezionato,
                barcode: ean,
                variantPrice: prezzo || 0,
                variantInventoryQty: quantita || 0,
                immaginiUrls: JSON.stringify(immagini || []),
                specificheJson: JSON.stringify(specifiche || []),
                metafieldsJson: metafieldsJson,
                statoCaricamento: 'pending'
            },
            update: {
                title: nome || `Prodotto ${ean}`,
                bodyHtml: descrizione || '',
                vendor: marca || 'Generico',
                productType: categoria || 'Manuale',
                variantPrice: prezzo || 0,
                variantInventoryQty: quantita || 0,
                immaginiUrls: JSON.stringify(immagini || []),
                specificheJson: JSON.stringify(specifiche || []),
                metafieldsJson: metafieldsJson,
                statoCaricamento: 'pending'
            }
        });

        return { masterFileId: masterFile.id, outputId: output.id };
    }

    /**
     * Esegue il push immediato su Shopify
     */
    static async pushToShopify(utenteId: number, outputId: number) {
        return await ShopifyService.retrySingleProduct(utenteId, outputId);
    }
}
