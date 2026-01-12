const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

// Get configuration by category
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;

        const result = await query(
            `SELECT chiave, valore, tipo_dato, descrizione 
       FROM configurazione_sistema 
       WHERE categoria = $1`,
            [category.toUpperCase()]
        );

        const config = {};
        result.rows.forEach(row => {
            // Don't send encrypted values to client
            if (row.chiave.includes('PASSWORD') || row.chiave.includes('API_KEY')) {
                config[row.chiave] = row.valore ? '********' : '';
            } else {
                config[row.chiave] = row.valore;
            }
        });

        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update configuration
router.post('/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { config } = req.body;

        for (const [key, value] of Object.entries(config)) {
            // Skip if value is masked
            if (value === '********') continue;

            await query(`
        UPDATE configurazione_sistema
        SET valore = $1, updated_at = NOW()
        WHERE chiave = $2 AND categoria = $3
      `, [value, key, category.toUpperCase()]);
        }

        res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test ICecat connection
router.post('/icecat/test', async (req, res) => {
    try {
        const { username, apiKey } = req.body;

        const axios = require('axios');
        const response = await axios.get(
            `https://live.icecat.biz/api/?UserName=${username}&Language=IT&GTIN=8806098149940`,
            {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 10000
            }
        );

        res.json({ success: true, message: 'ICecat connection successful' });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `ICecat connection failed: ${error.message}`
        });
    }
});

// Test Shopify connection
router.post('/shopify/test', async (req, res) => {
    try {
        const { shopUrl, apiKey, apiPassword } = req.body;

        const axios = require('axios');
        const response = await axios.get(
            `https://${shopUrl}/admin/api/2024-01/shop.json`,
            {
                auth: {
                    username: apiKey,
                    password: apiPassword
                },
                timeout: 10000
            }
        );

        res.json({
            success: true,
            message: 'Shopify connection successful',
            shop: response.data.shop.name
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Shopify connection failed: ${error.message}`
        });
    }
});

module.exports = router;
