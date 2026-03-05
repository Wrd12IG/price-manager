import { Router } from 'express';
import {
    getConfig, saveConfig, syncProducts, generateExport, getPreview, getProgress,
    downloadCSV, savePlaceholder, cancelSync, resetOutput, getSyncLogs, retryProduct,
    toggleBlacklist, getPriceHistory, getCategoryMapping, saveCategoryMapping, getProductPreview
} from '../controllers/shopify.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Protezione multi-tenant
router.use(authMiddleware);

router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/placeholder', savePlaceholder);
router.post('/generate', generateExport);
router.post('/sync', syncProducts);
router.post('/cancel', cancelSync);             // 🛑 Stop sync in corso
router.post('/reset', resetOutput);             // 🔄 Reset DB Shopify
router.post('/retry/:id', retryProduct);        // 🔁 Retry singolo prodotto in errore
router.post('/blacklist/:id', toggleBlacklist); // 🚫 Toggle blacklist prodotto
router.get('/preview', getPreview);             // 📋 Tabella anteprima output con filtri
router.get('/preview/:id', getProductPreview);  // 👁️ Dati completi per modal prodotto
router.get('/progress', getProgress);
router.get('/export/csv', downloadCSV);
router.get('/logs', getSyncLogs);               // 📡 Live log feed (polling)
router.get('/price-history/:masterFileId', getPriceHistory); // 📈 Storico prezzi prodotto
router.get('/category-mapping', getCategoryMapping);         // 🗂️ Leggi mappatura categorie
router.post('/category-mapping', saveCategoryMapping);       // 🗂️ Salva mappatura categorie

export default router;
