// @ts-nocheck
import { Response } from 'express';
import { ShopifyService } from '../services/ShopifyService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';

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
    const { ShopifyExportService } = await import('../services/ShopifyExportService');

    const pendingCount = await prisma.outputShopify.count({ where: { utenteId, statoCaricamento: 'pending' } });

    let prepared = 0;
    if (pendingCount === 0) {
        const exported = await ShopifyExportService.generateExport(utenteId);
        prepared = exported.length;
    } else {
        prepared = pendingCount;
    }

    const result = await ShopifyService.syncProducts(utenteId);
    res.json({ success: true, message: 'Sincronizzazione completata', data: { prepared, ...result } });
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
    const result = await ShopifyService.generateOutputPreview(utenteId, page, limit);
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
        p.variantPrice, p.variantCompareAtPrice || '',
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
