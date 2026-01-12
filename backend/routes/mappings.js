const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Get field mappings for a supplier
router.get('/fields/:supplierId', async (req, res) => {
    try {
        const { supplierId } = req.params;

        const result = await query(
            `SELECT * FROM mappatura_campi 
       WHERE id_fornitore = $1 
       ORDER BY ordine_priorita`,
            [supplierId]
        );

        res.json({ success: true, mappings: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save field mappings for a supplier
router.post('/fields/:supplierId', async (req, res) => {
    try {
        const { supplierId } = req.params;
        const { mappings } = req.body;

        // Delete existing mappings
        await query('DELETE FROM mappatura_campi WHERE id_fornitore = $1', [supplierId]);

        // Insert new mappings
        for (const mapping of mappings) {
            await query(`
        INSERT INTO mappatura_campi (
          id_fornitore,
          campo_originale,
          campo_standard,
          tipo_dato,
          trasformazione_richiesta,
          ordine_priorita
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
                supplierId,
                mapping.campo_originale,
                mapping.campo_standard,
                mapping.tipo_dato || 'STRING',
                mapping.trasformazione_richiesta || null,
                mapping.ordine_priorita || 0
            ]);
        }

        res.json({ success: true, message: 'Field mappings saved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get category mappings for a supplier
router.get('/categories/:supplierId', async (req, res) => {
    try {
        const { supplierId } = req.params;

        const result = await query(
            `SELECT * FROM mappatura_categorie 
       WHERE id_fornitore = $1 
       ORDER BY categoria_fornitore`,
            [supplierId]
        );

        res.json({ success: true, mappings: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save category mappings for a supplier
router.post('/categories/:supplierId', async (req, res) => {
    try {
        const { supplierId } = req.params;
        const { mappings } = req.body;

        // Delete existing mappings
        await query('DELETE FROM mappatura_categorie WHERE id_fornitore = $1', [supplierId]);

        // Insert new mappings
        for (const mapping of mappings) {
            await query(`
        INSERT INTO mappatura_categorie (
          id_fornitore,
          categoria_fornitore,
          categoria_ecommerce,
          priorita
        ) VALUES ($1, $2, $3, $4)
      `, [
                supplierId,
                mapping.categoria_fornitore,
                mapping.categoria_ecommerce,
                mapping.priorita || 1
            ]);
        }

        res.json({ success: true, message: 'Category mappings saved' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unmapped categories for a supplier
router.get('/categories/:supplierId/unmapped', async (req, res) => {
    try {
        const { supplierId } = req.params;

        const result = await query(`
      SELECT DISTINCT categoria_fornitore, COUNT(*) as product_count
      FROM listini_raw
      WHERE id_fornitore = $1
      AND categoria_fornitore IS NOT NULL
      AND categoria_fornitore NOT IN (
        SELECT categoria_fornitore 
        FROM mappatura_categorie 
        WHERE id_fornitore = $1
      )
      GROUP BY categoria_fornitore
      ORDER BY product_count DESC
    `, [supplierId]);

        res.json({ success: true, unmapped: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
