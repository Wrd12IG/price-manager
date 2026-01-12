const { query } = require('../config/database');
const ingestionService = require('./ingestion.service');
const normalizationService = require('./normalization.service');
const consolidationService = require('./consolidation.service');
const pricingService = require('./pricing.service');
const enrichmentService = require('./enrichment.service');
const aiService = require('./ai.service');
const { notifyProcessCompletion } = require('../utils/notifications');

/**
 * Run the complete data processing pipeline
 * @param {Object} options - Pipeline options
 * @returns {Promise<Object>} Pipeline execution result
 */
async function runFullPipeline(options = {}) {
    const {
        skipIngestion = false,
        skipEnrichment = false,
        skipAI = false,
        aiLimit = 100 // Limit AI processing to control costs
    } = options;

    console.log('='.repeat(60));
    console.log('STARTING FULL PIPELINE EXECUTION');
    console.log('='.repeat(60));

    const startTime = Date.now();
    const results = {
        success: true,
        timestamp: new Date().toISOString(),
        phases: {},
        errors: [],
        warnings: []
    };

    try {
        // Phase 1: Ingestion
        if (!skipIngestion) {
            console.log('\n[PHASE 1/7] Data Ingestion');
            const phaseStart = Date.now();

            await logPhase('INGESTIONE', 'running', { message: 'Starting data ingestion' });

            const ingestionResult = await ingestionService.ingestAllSuppliers();
            const phaseDuration = Date.now() - phaseStart;

            results.phases.ingestion = {
                success: ingestionResult.every(r => r.success),
                results: ingestionResult,
                duration: phaseDuration
            };

            const successCount = ingestionResult.filter(r => r.success).length;
            const failCount = ingestionResult.filter(r => !r.success).length;

            await logPhase('INGESTIONE', successCount > 0 ? 'success' : 'error', {
                suppliers: ingestionResult.length,
                success: successCount,
                failed: failCount
            }, phaseDuration / 1000);

            if (failCount > 0) {
                results.warnings.push(`${failCount} suppliers failed during ingestion`);
            }
        }

        // Phase 2: Normalization
        console.log('\n[PHASE 2/7] Data Normalization');
        const normStart = Date.now();

        await logPhase('NORMALIZZAZIONE', 'running', { message: 'Applying field and category mappings' });

        const normalizationResult = await normalizationService.normalizeAllSuppliers();
        const normDuration = Date.now() - normStart;

        results.phases.normalization = {
            success: normalizationResult.every(r => r.success),
            results: normalizationResult,
            duration: normDuration
        };

        await logPhase('NORMALIZZAZIONE', 'success', {
            suppliers: normalizationResult.length
        }, normDuration / 1000);

        // Phase 3: Consolidation
        console.log('\n[PHASE 3/7] Product Consolidation');
        const consStart = Date.now();

        await logPhase('CONSOLIDAMENTO', 'running', { message: 'Consolidating products by EAN' });

        const consolidationResult = await consolidationService.consolidateProducts();
        const consDuration = Date.now() - consStart;

        results.phases.consolidation = consolidationResult;

        await logPhase('CONSOLIDAMENTO', consolidationResult.success ? 'success' : 'error', {
            productsConsolidated: consolidationResult.productsConsolidated
        }, consDuration / 1000);

        // Phase 4: Price Calculation
        console.log('\n[PHASE 4/7] Price Calculation');
        const priceStart = Date.now();

        await logPhase('CALCOLO_PREZZI', 'running', { message: 'Calculating selling prices' });

        const pricingResult = await pricingService.calculateAllPrices();
        const priceDuration = Date.now() - priceStart;

        results.phases.pricing = pricingResult;

        await logPhase('CALCOLO_PREZZI', pricingResult.success ? 'success' : 'error', {
            pricesCalculated: pricingResult.pricesCalculated
        }, priceDuration / 1000);

        // Phase 5: ICecat Enrichment (optional)
        if (!skipEnrichment) {
            console.log('\n[PHASE 5/7] ICecat Enrichment');
            const enrichStart = Date.now();

            await logPhase('ARRICCHIMENTO_ICECAT', 'running', { message: 'Fetching product data from ICecat' });

            const enrichmentResult = await enrichmentService.enrichAllProducts();
            const enrichDuration = Date.now() - enrichStart;

            results.phases.enrichment = enrichmentResult;

            await logPhase('ARRICCHIMENTO_ICECAT', enrichmentResult.success ? 'success' : 'warning', {
                enriched: enrichmentResult.enrichedCount,
                failed: enrichmentResult.failedCount
            }, enrichDuration / 1000);

            if (enrichmentResult.failedCount > 0) {
                results.warnings.push(`${enrichmentResult.failedCount} products failed ICecat enrichment`);
            }
        }

        // Phase 6: AI Enhancement (optional)
        if (!skipAI) {
            console.log('\n[PHASE 6/7] AI Content Enhancement');
            const aiStart = Date.now();

            await logPhase('ARRICCHIMENTO_AI', 'running', { message: `Enhancing descriptions with AI (limit: ${aiLimit})` });

            const aiResult = await aiService.enhanceAllProducts(aiLimit);
            const aiDuration = Date.now() - aiStart;

            results.phases.ai = aiResult;

            await logPhase('ARRICCHIMENTO_AI', aiResult.success ? 'success' : 'warning', {
                enhanced: aiResult.enhancedCount,
                cost: aiResult.totalCost
            }, aiDuration / 1000);

            results.warnings.push(`AI processing cost: €${aiResult.totalCost?.toFixed(2) || 0}`);
        }

        // Phase 7: Generate Output (Shopify export will be separate)
        console.log('\n[PHASE 7/7] Pipeline Complete');

        const totalDuration = Date.now() - startTime;
        results.duration = totalDuration;

        // Get final statistics
        const statsResult = await query('SELECT COUNT(*) as count FROM master_file');
        results.totalProducts = parseInt(statsResult.rows[0].count);

        await logPhase('COMPLETO', 'success', {
            totalProducts: results.totalProducts,
            totalDuration: Math.round(totalDuration / 1000)
        }, totalDuration / 1000);

        console.log('\n' + '='.repeat(60));
        console.log('PIPELINE EXECUTION COMPLETE');
        console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s`);
        console.log(`Total Products: ${results.totalProducts}`);
        console.log('='.repeat(60) + '\n');

        // Send notifications
        await notifyProcessCompletion({
            success: true,
            duration: totalDuration,
            productsProcessed: results.totalProducts,
            errors: results.errors,
            warnings: results.warnings,
            timestamp: results.timestamp
        });

        return results;
    } catch (error) {
        console.error('Pipeline execution error:', error);

        results.success = false;
        results.errors.push(error.message);
        results.duration = Date.now() - startTime;

        await logPhase('COMPLETO', 'error', {
            error: error.message
        }, results.duration / 1000);

        // Send error notification
        await notifyProcessCompletion({
            success: false,
            duration: results.duration,
            productsProcessed: 0,
            errors: [error.message],
            warnings: results.warnings,
            timestamp: results.timestamp
        });

        return results;
    }
}

/**
 * Log pipeline phase to database
 * @param {string} phase - Phase name
 * @param {string} status - Phase status (running, success, error, warning)
 * @param {Object} details - Phase details
 * @param {number} duration - Duration in seconds
 */
async function logPhase(phase, status, details = {}, duration = null) {
    try {
        await query(`
      INSERT INTO log_elaborazioni (
        fase_processo,
        stato,
        dettagli,
        durata_secondi,
        prodotti_elaborati
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
            phase,
            status,
            JSON.stringify(details),
            duration ? Math.round(duration) : null,
            details.productsProcessed || details.productsConsolidated || details.pricesCalculated || 0
        ]);
    } catch (error) {
        console.error('Error logging phase:', error);
    }
}

/**
 * Get pipeline execution history
 * @param {number} limit - Number of executions to retrieve
 * @returns {Promise<Array>} Execution history
 */
async function getExecutionHistory(limit = 10) {
    const result = await query(`
    SELECT 
      data_esecuzione,
      fase_processo,
      stato,
      dettagli,
      durata_secondi,
      prodotti_elaborati
    FROM log_elaborazioni
    WHERE fase_processo = 'COMPLETO'
    ORDER BY data_esecuzione DESC
    LIMIT $1
  `, [limit]);

    return result.rows;
}

/**
 * Get latest pipeline status
 * @returns {Promise<Object>} Latest status
 */
async function getLatestStatus() {
    const result = await query(`
    SELECT * FROM log_elaborazioni
    WHERE fase_processo = 'COMPLETO'
    ORDER BY data_esecuzione DESC
    LIMIT 1
  `);

    if (result.rows.length === 0) {
        return { status: 'never_run' };
    }

    return result.rows[0];
}

module.exports = {
    runFullPipeline,
    logPhase,
    getExecutionHistory,
    getLatestStatus
};
