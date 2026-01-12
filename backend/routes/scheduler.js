const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { runFullPipeline, getExecutionHistory, getLatestStatus } = require('../services/orchestrator.service');

let isRunning = false;
let currentExecution = null;

// Get scheduler status
router.get('/status', async (req, res) => {
    try {
        const configResult = await query(`
      SELECT chiave, valore FROM configurazione_sistema
      WHERE categoria = 'SCHEDULER'
    `);

        const config = {};
        configResult.rows.forEach(row => {
            config[row.chiave] = row.valore;
        });

        const latestStatus = await getLatestStatus();

        res.json({
            success: true,
            config,
            isRunning,
            latestExecution: latestStatus,
            currentExecution
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update scheduler configuration
router.post('/configure', async (req, res) => {
    try {
        const { frequency, time, enabled } = req.body;

        if (frequency) {
            await query(
                `UPDATE configurazione_sistema 
         SET valore = $1 
         WHERE chiave = 'SCHEDULER_FREQUENCY'`,
                [frequency]
            );
        }

        if (time) {
            await query(
                `UPDATE configurazione_sistema 
         SET valore = $1 
         WHERE chiave = 'SCHEDULER_TIME'`,
                [time]
            );
        }

        if (enabled !== undefined) {
            await query(
                `UPDATE configurazione_sistema 
         SET valore = $1 
         WHERE chiave = 'SCHEDULER_ENABLED'`,
                [enabled.toString()]
            );
        }

        res.json({ success: true, message: 'Scheduler configuration updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Run pipeline manually
router.post('/run-now', async (req, res) => {
    try {
        if (isRunning) {
            return res.status(409).json({
                success: false,
                error: 'Pipeline is already running'
            });
        }

        const options = req.body.options || {};

        // Start execution in background
        isRunning = true;
        currentExecution = {
            startTime: new Date().toISOString(),
            status: 'running'
        };

        // Don't await - run in background
        runFullPipeline(options)
            .then(result => {
                currentExecution = {
                    ...currentExecution,
                    endTime: new Date().toISOString(),
                    status: result.success ? 'completed' : 'failed',
                    result
                };
                isRunning = false;
            })
            .catch(error => {
                currentExecution = {
                    ...currentExecution,
                    endTime: new Date().toISOString(),
                    status: 'error',
                    error: error.message
                };
                isRunning = false;
            });

        res.json({
            success: true,
            message: 'Pipeline execution started',
            execution: currentExecution
        });
    } catch (error) {
        isRunning = false;
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get execution history
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const history = await getExecutionHistory(limit);

        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get detailed logs for a specific execution
router.get('/logs/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const result = await query(`
      SELECT * FROM log_elaborazioni
      WHERE DATE(data_esecuzione) = $1
      ORDER BY data_esecuzione DESC
    `, [date]);

        res.json({ success: true, logs: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
