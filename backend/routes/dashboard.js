const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { getConsolidationStats } = require('../services/consolidation.service');
const { getPricingStats } = require('../services/pricing.service');

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = {};

        // Total products
        const productsResult = await query(
            'SELECT COUNT(*) as count FROM master_file'
        );
        stats.totalProducts = parseInt(productsResult.rows[0].count);

        // Total suppliers
        const suppliersResult = await query(
            'SELECT COUNT(*) as count FROM fornitori WHERE attivo = true'
        );
        stats.activeSuppliers = parseInt(suppliersResult.rows[0].count);

        // Total inventory value
        const inventoryResult = await query(`
      SELECT SUM(prezzo_acquisto_migliore * quantita_totale_aggregata) as value
      FROM master_file
    `);
        stats.inventoryValue = parseFloat(inventoryResult.rows[0].value || 0);

        // Products with pricing
        const pricedResult = await query(
            'SELECT COUNT(*) as count FROM master_file WHERE prezzo_vendita_calcolato IS NOT NULL'
        );
        stats.productsPriced = parseInt(pricedResult.rows[0].count);

        // Products with ICecat data
        const icecatResult = await query(
            'SELECT COUNT(*) as count FROM dati_icecat'
        );
        stats.productsWithIcecat = parseInt(icecatResult.rows[0].count);

        // Products with AI enhancement
        const aiResult = await query(
            'SELECT COUNT(*) as count FROM prodotti_ai_enhanced'
        );
        stats.productsWithAI = parseInt(aiResult.rows[0].count);

        // Latest execution
        const latestExecResult = await query(`
      SELECT * FROM log_elaborazioni
      WHERE fase_processo = 'COMPLETO'
      ORDER BY data_esecuzione DESC
      LIMIT 1
    `);
        stats.latestExecution = latestExecResult.rows[0] || null;

        // Recent errors
        const errorsResult = await query(`
      SELECT COUNT(*) as count FROM log_elaborazioni
      WHERE stato = 'error'
      AND data_esecuzione >= NOW() - INTERVAL '7 days'
    `);
        stats.recentErrors = parseInt(errorsResult.rows[0].count);

        // Get consolidation stats
        const consolidationStats = await getConsolidationStats();
        stats.consolidation = consolidationStats;

        // Get pricing stats
        const pricingStats = await getPricingStats();
        stats.pricing = pricingStats;

        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent activity
router.get('/activity', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;

        const result = await query(`
      SELECT * FROM log_elaborazioni
      ORDER BY data_esecuzione DESC
      LIMIT $1
    `, [limit]);

        res.json({ success: true, activity: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get products by category
router.get('/products-by-category', async (req, res) => {
    try {
        const result = await query(`
      SELECT 
        categoria_ecommerce,
        COUNT(*) as count,
        AVG(prezzo_vendita_calcolato) as avg_price
      FROM master_file
      WHERE categoria_ecommerce IS NOT NULL
      GROUP BY categoria_ecommerce
      ORDER BY count DESC
      LIMIT 10
    `);

        res.json({ success: true, categories: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get top products by price
router.get('/top-products', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const orderBy = req.query.orderBy || 'price'; // price, quantity, margin

        let orderClause = 'prezzo_vendita_calcolato DESC';
        if (orderBy === 'quantity') {
            orderClause = 'quantita_totale_aggregata DESC';
        } else if (orderBy === 'margin') {
            orderClause = '(prezzo_vendita_calcolato - prezzo_acquisto_migliore) DESC';
        }

        const result = await query(`
      SELECT 
        ean_gtin,
        sku_selezionato,
        marca,
        categoria_ecommerce,
        prezzo_acquisto_migliore,
        prezzo_vendita_calcolato,
        quantita_totale_aggregata,
        (prezzo_vendita_calcolato - prezzo_acquisto_migliore) as margin
      FROM master_file
      WHERE prezzo_vendita_calcolato IS NOT NULL
      ORDER BY ${orderClause}
      LIMIT $1
    `, [limit]);

        res.json({ success: true, products: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
