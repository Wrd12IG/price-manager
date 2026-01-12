const { query, getClient } = require('../config/database');

/**
 * Consolidate products from all suppliers
 * Groups by EAN/GTIN and selects best price
 * @returns {Promise<Object>} Consolidation result
 */
async function consolidateProducts() {
    console.log('Starting product consolidation...');

    const startTime = Date.now();

    try {
        // Get all products with valid EAN from latest imports
        const productsResult = await query(`
      SELECT 
        lr.ean_gtin,
        lr.sku_fornitore,
        lr.id_fornitore,
        lr.prezzo_acquisto,
        lr.quantita_disponibile,
        lr.categoria_fornitore,
        lr.marca,
        lr.descrizione_originale,
        f.nome_fornitore
      FROM listini_raw lr
      JOIN fornitori f ON lr.id_fornitore = f.id_fornitore
      WHERE lr.ean_gtin IS NOT NULL
      AND lr.ean_gtin != ''
      AND lr.prezzo_acquisto IS NOT NULL
      AND lr.prezzo_acquisto > 0
      AND lr.data_importazione >= NOW() - INTERVAL '1 day'
      ORDER BY lr.ean_gtin, lr.prezzo_acquisto ASC
    `);

        const products = productsResult.rows;
        console.log(`Found ${products.length} products to consolidate`);

        // Group products by EAN
        const productsByEAN = {};

        for (const product of products) {
            const ean = product.ean_gtin;

            if (!productsByEAN[ean]) {
                productsByEAN[ean] = [];
            }

            productsByEAN[ean].push(product);
        }

        console.log(`Grouped into ${Object.keys(productsByEAN).length} unique products`);

        let consolidatedCount = 0;

        // Process each product group
        for (const [ean, productGroup] of Object.entries(productsByEAN)) {
            try {
                await consolidateProductGroup(ean, productGroup);
                consolidatedCount++;
            } catch (error) {
                console.error(`Error consolidating product ${ean}:`, error.message);
            }
        }

        const duration = Date.now() - startTime;

        console.log(`Consolidated ${consolidatedCount} products in ${duration}ms`);

        return {
            success: true,
            productsConsolidated: consolidatedCount,
            duration
        };
    } catch (error) {
        console.error('Consolidation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Consolidate a group of products with the same EAN
 * @param {string} ean - EAN/GTIN code
 * @param {Array} productGroup - Array of products from different suppliers
 */
async function consolidateProductGroup(ean, productGroup) {
    // Select best supplier (lowest price)
    const bestProduct = selectBestSupplier(productGroup);

    // Aggregate quantities from all suppliers
    const totalQuantity = aggregateQuantities(productGroup);

    // Get category mapping (use first non-null category)
    const categoryResult = await query(`
    SELECT mc.categoria_ecommerce
    FROM mappatura_categorie mc
    WHERE mc.categoria_fornitore = $1
    LIMIT 1
  `, [bestProduct.categoria_fornitore]);

    const categoria_ecommerce = categoryResult.rows.length > 0
        ? categoryResult.rows[0].categoria_ecommerce
        : bestProduct.categoria_fornitore;

    // Upsert into master_file
    await query(`
    INSERT INTO master_file (
      ean_gtin,
      sku_selezionato,
      id_fornitore_selezionato,
      prezzo_acquisto_migliore,
      quantita_totale_aggregata,
      categoria_ecommerce,
      marca,
      descrizione_base,
      data_ultimo_aggiornamento
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (ean_gtin) DO UPDATE SET
      sku_selezionato = EXCLUDED.sku_selezionato,
      id_fornitore_selezionato = EXCLUDED.id_fornitore_selezionato,
      prezzo_acquisto_migliore = EXCLUDED.prezzo_acquisto_migliore,
      quantita_totale_aggregata = EXCLUDED.quantita_totale_aggregata,
      categoria_ecommerce = EXCLUDED.categoria_ecommerce,
      marca = EXCLUDED.marca,
      descrizione_base = EXCLUDED.descrizione_base,
      data_ultimo_aggiornamento = NOW()
  `, [
        ean,
        bestProduct.sku_fornitore,
        bestProduct.id_fornitore,
        bestProduct.prezzo_acquisto,
        totalQuantity,
        categoria_ecommerce,
        bestProduct.marca,
        bestProduct.descrizione_originale
    ]);
}

/**
 * Select best supplier based on price
 * @param {Array} productGroup - Products with same EAN
 * @returns {Object} Best product (lowest price)
 */
function selectBestSupplier(productGroup) {
    if (productGroup.length === 0) {
        throw new Error('Empty product group');
    }

    // Products are already sorted by price ASC, so first one is cheapest
    return productGroup[0];
}

/**
 * Aggregate quantities from all suppliers
 * @param {Array} productGroup - Products with same EAN
 * @returns {number} Total quantity
 */
function aggregateQuantities(productGroup) {
    return productGroup.reduce((total, product) => {
        return total + (product.quantita_disponibile || 0);
    }, 0);
}

/**
 * Get consolidation statistics
 * @returns {Promise<Object>} Statistics
 */
async function getConsolidationStats() {
    const stats = {};

    // Total products in master file
    const totalResult = await query(
        'SELECT COUNT(*) as count FROM master_file'
    );
    stats.totalProducts = parseInt(totalResult.rows[0].count);

    // Products by supplier
    const bySupplierResult = await query(`
    SELECT f.nome_fornitore, COUNT(*) as count
    FROM master_file mf
    JOIN fornitori f ON mf.id_fornitore_selezionato = f.id_fornitore
    GROUP BY f.nome_fornitore
    ORDER BY count DESC
  `);
    stats.bySupplier = bySupplierResult.rows;

    // Products by category
    const byCategoryResult = await query(`
    SELECT categoria_ecommerce, COUNT(*) as count
    FROM master_file
    WHERE categoria_ecommerce IS NOT NULL
    GROUP BY categoria_ecommerce
    ORDER BY count DESC
    LIMIT 10
  `);
    stats.byCategory = byCategoryResult.rows;

    // Average price
    const avgPriceResult = await query(
        'SELECT AVG(prezzo_acquisto_migliore) as avg_price FROM master_file'
    );
    stats.averagePrice = parseFloat(avgPriceResult.rows[0].avg_price || 0);

    // Total inventory
    const totalQtyResult = await query(
        'SELECT SUM(quantita_totale_aggregata) as total_qty FROM master_file'
    );
    stats.totalQuantity = parseInt(totalQtyResult.rows[0].total_qty || 0);

    return stats;
}

/**
 * Get products with multiple suppliers
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Products available from multiple suppliers
 */
async function getProductsWithMultipleSuppliers(limit = 100) {
    const result = await query(`
    SELECT 
      lr.ean_gtin,
      COUNT(DISTINCT lr.id_fornitore) as supplier_count,
      MIN(lr.prezzo_acquisto) as min_price,
      MAX(lr.prezzo_acquisto) as max_price,
      MAX(lr.descrizione_originale) as descrizione
    FROM listini_raw lr
    WHERE lr.ean_gtin IS NOT NULL
    AND lr.prezzo_acquisto IS NOT NULL
    AND lr.data_importazione >= NOW() - INTERVAL '1 day'
    GROUP BY lr.ean_gtin
    HAVING COUNT(DISTINCT lr.id_fornitore) > 1
    ORDER BY supplier_count DESC
    LIMIT $1
  `, [limit]);

    return result.rows;
}

module.exports = {
    consolidateProducts,
    consolidateProductGroup,
    selectBestSupplier,
    aggregateQuantities,
    getConsolidationStats,
    getProductsWithMultipleSuppliers
};
