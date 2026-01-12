import { Request, Response } from 'express';
import { ShopifyService } from '../services/ShopifyService';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * GET /api/shopify/config
 * Ottiene stato configurazione (senza token)
 */
export const getConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await ShopifyService.getConfig();
    res.json({
        success: true,
        data: config
    });
});

/**
 * POST /api/shopify/config
 * Salva configurazione
 */
export const saveConfig = asyncHandler(async (req: Request, res: Response) => {
    const { shopUrl, accessToken } = req.body;
    await ShopifyService.saveConfig(shopUrl, accessToken);
    res.json({
        success: true,
        message: 'Configurazione salvata'
    });
});

/**
 * POST /api/shopify/sync
 * Avvia sincronizzazione (prepare + sync)
 */
import prisma from '../config/database';

export const syncProducts = asyncHandler(async (req: Request, res: Response) => {
    // 1. Controlla se ci sono già prodotti pronti (generati da AIEnrichmentService)

    const pendingCount = await prisma.outputShopify.count({
        where: { statoCaricamento: 'pending' }
    });

    let prepared = 0;

    // Chiama prepareExport SOLO se non ci sono prodotti pending
    if (pendingCount === 0) {
        console.log('Nessun prodotto pending trovato. Eseguo prepareExport...');
        prepared = await ShopifyService.prepareExport();
    } else {
        console.log(`Trovati ${pendingCount} prodotti pending. Salto prepareExport.`);
        prepared = pendingCount;
    }

    // 2. Sync

    // 2. Sync
    const result = await ShopifyService.syncToShopify();

    res.json({
        success: true,
        message: 'Sincronizzazione completata',
        data: {
            prepared,
            ...result
        }
    });
});

/**
 * POST /api/shopify/generate
 * Genera export Shopify SENZA sincronizzare (solo anteprima)
 */
export const generateExport = asyncHandler(async (req: Request, res: Response) => {
    console.log('Generazione export Shopify (solo anteprima)...');
    const prepared = await ShopifyService.prepareExport();

    res.json({
        success: true,
        message: 'Export generato con successo',
        data: {
            prepared,
            message: `${prepared} prodotti pronti per l'export`
        }
    });
});

/**
 * GET /api/shopify/preview
 * Ottiene anteprima output
 */
export const getPreview = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await ShopifyService.generateOutputPreview(page, limit);
    res.json({ success: true, data: result });
});

/**
 * GET /api/shopify/progress
 * Ottiene stato di avanzamento sincronizzazione
 */
export const getProgress = asyncHandler(async (req: Request, res: Response) => {
    const progress = await ShopifyService.getSyncProgress();
    res.json({ success: true, data: progress });
});

/**
 * GET /api/shopify/export/csv
 * Scarica il file CSV generato
 */
export const downloadCSV = asyncHandler(async (req: Request, res: Response) => {
    const fs = require('fs');
    const path = require('path');

    // Il file viene generato nella root del backend o in una cartella specifica
    // Assumiamo che sia nella root del backend come generato dallo script
    const filePath = path.join(__dirname, '../../shopify_export.csv');

    if (!fs.existsSync(filePath)) {
        console.log('File CSV non trovato. Generazione in corso...');
        await ShopifyService.prepareExport();
    }

    if (fs.existsSync(filePath)) {
        res.download(filePath, 'shopify_products_export.csv');
    } else {
        res.status(500).json({
            success: false,
            message: 'Errore nella generazione del file CSV.'
        });
    }
});

/**
 * POST /api/shopify/placeholder
 * Salva URL immagine placeholder
 */
export const savePlaceholder = asyncHandler(async (req: Request, res: Response) => {
    const { placeholderImageUrl } = req.body;

    // Salva in Configurazione
    await prisma.configurazioneSistema.upsert({
        where: { chiave: 'shopify_placeholder_image' },
        update: { valore: placeholderImageUrl },
        create: { chiave: 'shopify_placeholder_image', valore: placeholderImageUrl }
    });

    res.json({
        success: true,
        message: 'Placeholder salvato'
    });
});
