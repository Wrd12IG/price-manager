// @ts-nocheck
import { Response } from 'express';
import { ShopifyService } from '../services/ShopifyService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { setCancelFlag } from '../utils/syncCancelFlag';
import { getLogsAfter } from '../utils/syncLogBuffer';

/**
 * Controller per la gestione di Shopify - Multi-Tenant
 */

export const getConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);
    const config = await ShopifyService.getConfig(utenteId);
    res.json({ success: true, data: config });
});

export const saveConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { shopUrl, accessToken } = req.body;
    await ShopifyService.saveConfig(utenteId, shopUrl, accessToken);
    res.json({ success: true, message: 'Configurazione salvata' });
});

export const syncProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;

    // Avviamo in background tramite setImmediate per dare priorità assoluta alla risposta HTTP
    setImmediate(() => {
        logger.info(`🚀 [Utente ${utenteId}] Avvio Background Sync programmato...`);
        ShopifyService.syncProducts(utenteId).catch(err => {
            logger.error(`❌ Errore Background Sync per utente ${utenteId}:`, err.message);
        });
    });

    res.json({
        success: true,
        message: 'Sincronizzazione avviata in background. Puoi monitorare il progresso nella dashboard.',
        data: { background: true }
    });
});

export const generateExport = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { ShopifyExportService } = await import('../services/ShopifyExportService');
    const exported = await ShopifyExportService.generateExport(utenteId);
    res.json({ success: true, message: 'Export generato con successo', data: { prepared: exported.length } });
});

export const getPreview = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const stato = (req.query.stato as string) || 'all';
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = ((req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
    const result = await ShopifyService.generateOutputPreview(utenteId, page, limit, { search, stato, sortBy, sortOrder });
    res.json({ success: true, data: result });
});

export const getProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const progress = await ShopifyService.getSyncProgress(utenteId);
    res.json({ success: true, data: progress });
});

export const downloadCSV = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    // Carichiamo i dati Shopify dell'utente
    const products = await prisma.outputShopify.findMany({
        where: { utenteId },
        include: { masterFile: true }
    });

    if (products.length === 0) {
        throw new AppError('Nessun prodotto pronto per l\'export. Genera prima l\'export Shopify.', 404);
    }

    const headers = [
        'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
        'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Grams',
        'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
        'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
        'Image Src', 'Status'
    ];

    const escapeCsv = (val) => {
        if (!val) return '';
        const s = String(val);
        return (s.includes(';') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = products.map(p => [
        p.handle,
        escapeCsv(p.title),
        escapeCsv(p.bodyHtml),
        escapeCsv(p.vendor),
        escapeCsv(p.productType),
        escapeCsv(p.tags),
        'true', 'Title', 'Default Title',
        p.masterFile.skuSelezionato, '0', 'shopify',
        p.variantInventoryQty, 'deny', 'manual',
        typeof p.variantPrice === 'number' ? p.variantPrice.toFixed(2) : parseFloat(String(p.variantPrice || '0').replace(',', '.')).toFixed(2),
        p.variantCompareAtPrice ? (typeof p.variantCompareAtPrice === 'number' ? p.variantCompareAtPrice.toFixed(2) : parseFloat(String(p.variantCompareAtPrice).replace(',', '.')).toFixed(2)) : '',
        p.immaginiUrls ? JSON.parse(p.immaginiUrls)[0] || '' : '',
        'active'
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=shopify_export_${utenteId}.csv`);
    res.send('\uFEFF' + csvContent);
});

export const savePlaceholder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { placeholderImageUrl } = req.body;

    await prisma.configurazioneSistema.upsert({
        where: { utenteId_chiave: { utenteId, chiave: 'shopify_placeholder_image' } },
        update: { valore: placeholderImageUrl },
        create: { utenteId, chiave: 'shopify_placeholder_image', valore: placeholderImageUrl, tipo: 'string' }
    });

    res.json({ success: true, message: 'Placeholder salvato' });
});

/**
 * 🛑 CANCELLA LA SYNC IN CORSO
 * Imposta un flag — il loop in ShopifyService.syncProducts() lo controlla
 * e interrompe l'elaborazione al prossimo batch.
 */
export const cancelSync = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    setCancelFlag(utenteId);
    logger.warn(`🛑 [Utente ${utenteId}] Richiesta di cancellazione sync Shopify ricevuta`);
    res.json({ success: true, message: 'Cancellazione sync richiesta. Si fermerà al prossimo batch.' });
});

/**
 * 🔄 RESET COMPLETO OUTPUT SHOPIFY
 * Da usare DOPO aver cancellato tutti i prodotti dal pannello Shopify.
 * Azzera shopifyProductId e riporta tutti i record a 'pending'.
 */
export const resetOutput = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;

    logger.warn(`🔄 [Utente ${utenteId}] Avvio RESET completo output Shopify`);


    const result = await prisma.outputShopify.updateMany({
        where: { utenteId },
        data: {
            statoCaricamento: 'pending',
            shopifyProductId: null,
            errorMessage: null,
            // NON azzerare isAiEnriched: i metafields AI sono già in metafieldsJson
            // e verranno riutilizzati nel prossimo sync senza sprecare chiamate Gemini
        }
    });


    logger.info(`✅ [Utente ${utenteId}] Reset completato: ${result.count} record azzerati`);

    res.json({
        success: true,
        message: `Reset completato: ${result.count} prodotti riportati a "pending". Ora puoi avviare una nuova sincronizzazione.`,
        data: { reset: result.count }
    });
});
/**
 * 📡 GET LOG SYNC IN TEMPO REALE
 * Il frontend fa polling ogni 2s con ?since=<ts Unix ms>
 * Restituisce le entry di log generate dopo quel timestamp.
 */
export const getSyncLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const since = parseInt(req.query.since as string) || 0;
    const entries = getLogsAfter(utenteId, since);
    res.json({ success: true, data: entries });
});

/**
 * 🔁 RETRY SINGOLO PRODOTTO
 * Riprova la sincronizzazione di un singolo prodotto in errore senza rilanciare l'intera batch.
 */
export const retryProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const outputId = parseInt(req.params.id);

    if (!outputId) throw new AppError('ID prodotto mancante', 400);

    // Verifica che il record esista e appartenga all'utente (multi-tenant guard)
    const record = await prisma.outputShopify.findFirst({
        where: { id: outputId, utenteId }
    });
    if (!record) throw new AppError('Prodotto non trovato o non autorizzato', 404);

    // Rimette in pending e pulisce il messaggio di errore
    await prisma.outputShopify.update({
        where: { id: outputId },
        data: { statoCaricamento: 'pending', errorMessage: null }
    });

    // Avvia il retry in background — risposta immediata al client
    setImmediate(() => {
        ShopifyService.retrySingleProduct(utenteId, outputId).catch(err => {
            logger.error(`❌ Errore retry prodotto ${outputId} per utente ${utenteId}:`, err.message);
        });
    });

    res.json({
        success: true,
        message: 'Retry avviato. Il prodotto verrà risincronizzato entro pochi secondi.',
        data: { id: outputId }
    });
});

/**
 * 🚫 BLACKLIST PRODOTTO
 * Toggle blacklist: se il prodotto è in errore/pending → blacklisted; se è blacklisted → pending
 */
export const toggleBlacklist = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const outputId = parseInt(req.params.id);
    if (!outputId) throw new AppError('ID prodotto mancante', 400);

    const record = await prisma.outputShopify.findFirst({ where: { id: outputId, utenteId } });
    if (!record) throw new AppError('Prodotto non trovato o non autorizzato', 404);

    const isBlacklisted = record.statoCaricamento === 'blacklisted';
    const newStato = isBlacklisted ? 'pending' : 'blacklisted';

    await prisma.outputShopify.update({
        where: { id: outputId },
        data: { statoCaricamento: newStato }
    });

    res.json({
        success: true,
        data: { id: outputId, statoCaricamento: newStato },
        message: isBlacklisted ? 'Prodotto riattivato.' : 'Prodotto aggiunto alla blacklist. Non verrà sincronizzato.'
    });
});

/**
 * 📈 STORICO PREZZI
 * Restituisce le ultime N variazioni di prezzo per un prodotto (masterFileId)
 */
export const getPriceHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const masterFileId = parseInt(req.params.masterFileId);
    if (!masterFileId) throw new AppError('masterFileId mancante', 400);

    // Verifica ownership
    const mf = await prisma.masterFile.findFirst({ where: { id: masterFileId, utenteId } });
    if (!mf) throw new AppError('Prodotto non trovato o non autorizzato', 404);

    const history = await prisma.priceHistory.findMany({
        where: { masterFileId, utenteId },
        orderBy: { createdAt: 'desc' },
        take: 30
    });

    res.json({ success: true, data: history });
});

/**
 * 🗂️ GET MAPPATURA CATEGORIE SHOPIFY
 */
export const getCategoryMapping = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const cfg = await prisma.configurazioneSistema.findFirst({
        where: { utenteId, chiave: 'shopify_category_mapping' }
    });
    const mapping = cfg?.valore ? JSON.parse(cfg.valore) : {};
    res.json({ success: true, data: mapping });
});

/**
 * 🗂️ SAVE MAPPATURA CATEGORIE SHOPIFY
 * Body: { mapping: { "Notebook": "Laptop & Computer", ... } }
 */
export const saveCategoryMapping = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const { mapping } = req.body;
    if (!mapping || typeof mapping !== 'object') throw new AppError('Payload mapping non valido', 400);

    await prisma.configurazioneSistema.upsert({
        where: { utenteId_chiave: { utenteId, chiave: 'shopify_category_mapping' } },
        update: { valore: JSON.stringify(mapping), tipo: 'json' },
        create: { utenteId, chiave: 'shopify_category_mapping', valore: JSON.stringify(mapping), tipo: 'json', descrizione: 'Mappatura categorie interne → product_type Shopify' }
    });

    res.json({ success: true, message: 'Mappatura categorie salvata.' });
});

/**
 * 👁️ PRODUCT PREVIEW (dati completi per il modal di anteprima)
 */
export const getProductPreview = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const outputId = parseInt(req.params.id);
    if (!outputId) throw new AppError('ID mancante', 400);

    const record = await prisma.outputShopify.findFirst({
        where: { id: outputId, utenteId },
        include: {
            masterFile: {
                include: {
                    fornitoreSelezionato: { select: { nomeFornitore: true } },
                    marchio: { select: { nome: true } },
                    categoria: { select: { nome: true } }
                }
            }
        }
    });
    if (!record) throw new AppError('Prodotto non trovato o non autorizzato', 404);

    res.json({ success: true, data: record });
});

