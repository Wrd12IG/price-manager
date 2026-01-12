const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { testPriceCalculation } = require('../services/pricing.service');

// Get all pricing rules
router.get('/', async (req, res) => {
    try {
        const result = await query(`
      SELECT * FROM regole_markup
      WHERE attivo = true
      ORDER BY priorita ASC, tipo_regola
    `);

        res.json({ success: true, rules: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new pricing rule
router.post('/', async (req, res) => {
    try {
        const {
            tipo_regola,
            riferimento,
            markup_percentuale = 0,
            markup_fisso = 0,
            costo_spedizione = 0,
            priorita,
            data_inizio_validita,
            data_fine_validita
        } = req.body;

        // Determine priority based on type if not provided
        let finalPriority = priorita;
        if (!finalPriority) {
            const priorityMap = {
                'PRODOTTO_SPECIFICO': 1,
                'MARCA': 2,
                'CATEGORIA': 3,
                'DEFAULT': 4
            };
            finalPriority = priorityMap[tipo_regola] || 3;
        }

        const result = await query(`
      INSERT INTO regole_markup (
        tipo_regola,
        riferimento,
        markup_percentuale,
        markup_fisso,
        costo_spedizione,
        priorita,
        data_inizio_validita,
        data_fine_validita,
        attivo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `, [
            tipo_regola,
            riferimento,
            markup_percentuale,
            markup_fisso,
            costo_spedizione,
            finalPriority,
            data_inizio_validita || null,
            data_fine_validita || null
        ]);

        res.status(201).json({ success: true, rule: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update pricing rule
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const fields = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (key !== 'id_regola') {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        values.push(id);

        await query(
            `UPDATE regole_markup SET ${fields.join(', ')} WHERE id_regola = $${paramCount}`,
            values
        );

        res.json({ success: true, message: 'Rule updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete pricing rule
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await query('DELETE FROM regole_markup WHERE id_regola = $1', [id]);

        res.json({ success: true, message: 'Rule deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test price calculation
router.post('/calculate', async (req, res) => {
    try {
        const { ean } = req.body;

        if (!ean) {
            return res.status(400).json({ success: false, error: 'EAN required' });
        }

        const result = await testPriceCalculation(ean);

        res.json({ success: true, calculation: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
