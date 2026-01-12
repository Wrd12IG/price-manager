const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const { isValidURL } = require('../utils/validators');
const { downloadSupplierFile, parseSupplierFile } = require('../services/ingestion.service');

// Get all suppliers
router.get('/', async (req, res) => {
    try {
        const result = await query(`
      SELECT 
        id_fornitore,
        nome_fornitore,
        url_listino,
        formato_file,
        tipo_accesso,
        attivo,
        ultima_sincronizzazione,
        frequenza_aggiornamento
      FROM fornitori
      ORDER BY nome_fornitore
    `);

        res.json({ success: true, suppliers: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single supplier
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM fornitori WHERE id_fornitore = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }

        const supplier = result.rows[0];

        // Don't send encrypted password to client
        delete supplier.password_accesso;

        res.json({ success: true, supplier });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new supplier
router.post('/', async (req, res) => {
    try {
        const {
            nome_fornitore,
            url_listino,
            formato_file,
            encoding = 'UTF-8',
            separatore_csv = ';',
            tipo_accesso,
            username_accesso,
            password_accesso,
            credenziali_extra,
            frequenza_aggiornamento = 'GIORNALIERA'
        } = req.body;

        // Validation
        if (!nome_fornitore || !url_listino || !formato_file || !tipo_accesso) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        if (!isValidURL(url_listino)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL'
            });
        }

        // Encrypt password if provided
        const encryptedPassword = password_accesso ? encrypt(password_accesso) : null;

        const result = await query(`
      INSERT INTO fornitori (
        nome_fornitore,
        url_listino,
        formato_file,
        encoding,
        separatore_csv,
        tipo_accesso,
        username_accesso,
        password_accesso,
        credenziali_extra,
        frequenza_aggiornamento,
        attivo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING id_fornitore, nome_fornitore
    `, [
            nome_fornitore,
            url_listino,
            formato_file,
            encoding,
            separatore_csv,
            tipo_accesso,
            username_accesso,
            encryptedPassword,
            credenziali_extra ? JSON.stringify(credenziali_extra) : null,
            frequenza_aggiornamento
        ]);

        res.status(201).json({
            success: true,
            supplier: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update supplier
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Encrypt password if being updated
        if (updates.password_accesso) {
            updates.password_accesso = encrypt(updates.password_accesso);
        }

        // Build dynamic update query
        const fields = [];
        const values = [];
        let paramCount = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (key !== 'id_fornitore') {
                fields.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        values.push(id);

        await query(
            `UPDATE fornitori SET ${fields.join(', ')} WHERE id_fornitore = $${paramCount}`,
            values
        );

        res.json({ success: true, message: 'Supplier updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete supplier
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await query('DELETE FROM fornitori WHERE id_fornitore = $1', [id]);

        res.json({ success: true, message: 'Supplier deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test supplier connection
router.post('/:id/test-connection', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM fornitori WHERE id_fornitore = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }

        const supplier = result.rows[0];

        // Try to download file
        const filePath = await downloadSupplierFile(supplier);

        // Clean up
        const fs = require('fs').promises;
        await fs.unlink(filePath);

        res.json({
            success: true,
            message: 'Connection successful'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Connection failed: ${error.message}`
        });
    }
});

// Preview supplier data
router.get('/:id/preview', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 5;

        const result = await query(
            'SELECT * FROM fornitori WHERE id_fornitore = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }

        const supplier = result.rows[0];

        // Download and parse file
        const filePath = await downloadSupplierFile(supplier);
        const data = await parseSupplierFile(filePath, supplier);

        // Return first N rows
        const preview = data.slice(0, limit);

        // Extract column names
        const columns = preview.length > 0 ? Object.keys(preview[0]) : [];

        // Clean up
        const fs = require('fs').promises;
        await fs.unlink(filePath);

        res.json({
            success: true,
            columns,
            preview,
            totalRows: data.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Preview failed: ${error.message}`
        });
    }
});

module.exports = router;
