import { Router } from 'express';
import {
    getDuplicates, ignoreDuplicatePair,
    getCompetitiveSuggestion, getCompetitorPrices, addCompetitorPrice,
    deleteCompetitorPrice, getMarketStats, savePositioningRule,
    reviewMetafields, reviewMetafieldsBatch,
    cleanupLongTitles,
    normalizeCategories
} from '../controllers/advanced.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

// ─── #13 Duplicate Detection ────────────────────────────
router.get('/duplicates', getDuplicates);                           // GET  /api/master-file/duplicates
router.post('/duplicates/ignore', ignoreDuplicatePair);             // POST /api/master-file/duplicates/ignore

// ─── #14 Competitive Pricing ────────────────────────────
router.get('/competitive-suggest/:masterFileId', getCompetitiveSuggestion);  // GET  /api/pricing/competitive-suggest/:id
router.get('/competitor-prices/:masterFileId', getCompetitorPrices);          // GET  /api/pricing/competitor-prices/:id
router.post('/competitor-prices', addCompetitorPrice);                         // POST /api/pricing/competitor-prices
router.delete('/competitor-prices/:id', deleteCompetitorPrice);                // DEL  /api/pricing/competitor-prices/:id
router.get('/market-stats', getMarketStats);                                   // GET  /api/pricing/market-stats
router.post('/positioning-rule', savePositioningRule);                         // POST /api/pricing/positioning-rule

// ─── #15 AI Metafield Review ────────────────────────────
router.post('/ai-review/:outputId', reviewMetafields);              // POST /api/shopify/ai-review/:id
router.post('/ai-review-batch', reviewMetafieldsBatch);             // POST /api/shopify/ai-review-batch

// ─── #16 EMERGENCY RESET ────────────────────────────
import { fullResetAdmin } from '../controllers/advanced.controller';
router.post('/reset-all', fullResetAdmin);                          // POST /api/advanced/reset-all
router.post('/cleanup-titles', cleanupLongTitles);                  // POST /api/advanced/cleanup-titles
router.post('/normalize-categories', normalizeCategories);           // POST /api/advanced/normalize-categories

export default router;
