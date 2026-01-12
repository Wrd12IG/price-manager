const { query } = require('../config/database');

/**
 * Calculate selling price for a product based on pricing rules
 * @param {Object} product - Product from master_file
 * @returns {Promise<number>} Calculated selling price
 */
async function calculatePrice(product) {
    // Find applicable pricing rule
    const rule = await findApplicableRule(product);

    if (!rule) {
        console.warn(`No pricing rule found for product ${product.ean_gtin}, using default`);
        // Get default rule
        const defaultResult = await query(
            `SELECT * FROM regole_markup 
       WHERE tipo_regola = 'DEFAULT' AND attivo = true 
       LIMIT 1`
        );

        if (defaultResult.rows.length === 0) {
            // Fallback: 20% markup if no default rule exists
            return applyMarkup(product.prezzo_acquisto_migliore, {
                markup_percentuale: 20,
                markup_fisso: 0,
                costo_spedizione: 0
            });
        }

        return applyMarkup(product.prezzo_acquisto_migliore, defaultResult.rows[0]);
    }

    return applyMarkup(product.prezzo_acquisto_migliore, rule);
}

/**
 * Find applicable pricing rule for a product
 * Priority: 1=Product, 2=Brand, 3=Category, 4=Default
 * @param {Object} product - Product from master_file
 * @returns {Promise<Object|null>} Pricing rule or null
 */
async function findApplicableRule(product) {
    const now = new Date().toISOString().split('T')[0];

    // Priority 1: Product-specific rule (by SKU or EAN)
    const productRuleResult = await query(`
    SELECT * FROM regole_markup
    WHERE tipo_regola = 'PRODOTTO_SPECIFICO'
    AND (riferimento = $1 OR riferimento = $2)
    AND attivo = true
    AND (data_inizio_validita IS NULL OR data_inizio_validita <= $3)
    AND (data_fine_validita IS NULL OR data_fine_validita >= $3)
    ORDER BY priorita ASC
    LIMIT 1
  `, [product.sku_selezionato, product.ean_gtin, now]);

    if (productRuleResult.rows.length > 0) {
        return productRuleResult.rows[0];
    }

    // Priority 2: Brand rule
    if (product.marca) {
        const brandRuleResult = await query(`
      SELECT * FROM regole_markup
      WHERE tipo_regola = 'MARCA'
      AND LOWER(riferimento) = LOWER($1)
      AND attivo = true
      AND (data_inizio_validita IS NULL OR data_inizio_validita <= $2)
      AND (data_fine_validita IS NULL OR data_fine_validita >= $2)
      ORDER BY priorita ASC
      LIMIT 1
    `, [product.marca, now]);

        if (brandRuleResult.rows.length > 0) {
            return brandRuleResult.rows[0];
        }
    }

    // Priority 3: Category rule
    if (product.categoria_ecommerce) {
        const categoryRuleResult = await query(`
      SELECT * FROM regole_markup
      WHERE tipo_regola = 'CATEGORIA'
      AND LOWER(riferimento) = LOWER($1)
      AND attivo = true
      AND (data_inizio_validita IS NULL OR data_inizio_validita <= $2)
      AND (data_fine_validita IS NULL OR data_fine_validita >= $2)
      ORDER BY priorita ASC
      LIMIT 1
    `, [product.categoria_ecommerce, now]);

        if (categoryRuleResult.rows.length > 0) {
            return categoryRuleResult.rows[0];
        }
    }

    // No specific rule found
    return null;
}

/**
 * Apply markup calculation
 * Formula: (cost + shipping) * (1 + markup%) + fixed_markup
 * @param {number} cost - Base cost (acquisition price)
 * @param {Object} rule - Pricing rule
 * @returns {number} Final selling price
 */
function applyMarkup(cost, rule) {
    if (!cost || cost <= 0) {
        return 0;
    }

    const baseCost = parseFloat(cost);
    const shipping = parseFloat(rule.costo_spedizione || 0);
    const markupPercent = parseFloat(rule.markup_percentuale || 0) / 100;
    const markupFixed = parseFloat(rule.markup_fisso || 0);

    // Calculate final price
    const priceWithShipping = baseCost + shipping;
    const priceWithPercentMarkup = priceWithShipping * (1 + markupPercent);
    const finalPrice = priceWithPercentMarkup + markupFixed;

    // Round to 2 decimals
    return Math.round(finalPrice * 100) / 100;
}

/**
 * Calculate prices for all products in master_file
 * @returns {Promise<Object>} Calculation result
 */
async function calculateAllPrices() {
    console.log('Calculating prices for all products...');

    const startTime = Date.now();

    try {
        // Get all products from master_file
        const productsResult = await query(`
      SELECT * FROM master_file
      WHERE prezzo_acquisto_migliore IS NOT NULL
      AND prezzo_acquisto_migliore > 0
    `);

        const products = productsResult.rows;
        console.log(`Calculating prices for ${products.length} products`);

        let calculatedCount = 0;

        for (const product of products) {
            try {
                const sellingPrice = await calculatePrice(product);

                // Update master_file with calculated price
                await query(`
          UPDATE master_file
          SET prezzo_vendita_calcolato = $1
          WHERE id_master = $2
        `, [sellingPrice, product.id_master]);

                calculatedCount++;
            } catch (error) {
                console.error(`Error calculating price for product ${product.ean_gtin}:`, error.message);
            }
        }

        const duration = Date.now() - startTime;

        console.log(`Calculated prices for ${calculatedCount} products in ${duration}ms`);

        return {
            success: true,
            pricesCalculated: calculatedCount,
            duration
        };
    } catch (error) {
        console.error('Price calculation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test price calculation for a specific product
 * @param {string} ean - Product EAN
 * @returns {Promise<Object>} Calculation details
 */
async function testPriceCalculation(ean) {
    const productResult = await query(
        'SELECT * FROM master_file WHERE ean_gtin = $1',
        [ean]
    );

    if (productResult.rows.length === 0) {
        throw new Error(`Product ${ean} not found`);
    }

    const product = productResult.rows[0];
    const rule = await findApplicableRule(product);
    const sellingPrice = await calculatePrice(product);

    return {
        product: {
            ean: product.ean_gtin,
            sku: product.sku_selezionato,
            marca: product.marca,
            categoria: product.categoria_ecommerce,
            costPrice: product.prezzo_acquisto_migliore
        },
        rule: rule ? {
            type: rule.tipo_regola,
            reference: rule.riferimento,
            markupPercent: rule.markup_percentuale,
            markupFixed: rule.markup_fisso,
            shippingCost: rule.costo_spedizione
        } : null,
        sellingPrice,
        margin: sellingPrice - product.prezzo_acquisto_migliore,
        marginPercent: ((sellingPrice - product.prezzo_acquisto_migliore) / product.prezzo_acquisto_migliore * 100).toFixed(2)
    };
}

/**
 * Get pricing statistics
 * @returns {Promise<Object>} Pricing statistics
 */
async function getPricingStats() {
    const stats = {};

    // Average margin
    const marginResult = await query(`
    SELECT 
      AVG(prezzo_vendita_calcolato - prezzo_acquisto_migliore) as avg_margin,
      AVG((prezzo_vendita_calcolato - prezzo_acquisto_migliore) / prezzo_acquisto_migliore * 100) as avg_margin_percent
    FROM master_file
    WHERE prezzo_vendita_calcolato IS NOT NULL
    AND prezzo_acquisto_migliore > 0
  `);

    stats.averageMargin = parseFloat(marginResult.rows[0].avg_margin || 0);
    stats.averageMarginPercent = parseFloat(marginResult.rows[0].avg_margin_percent || 0);

    // Price range
    const rangeResult = await query(`
    SELECT 
      MIN(prezzo_vendita_calcolato) as min_price,
      MAX(prezzo_vendita_calcolato) as max_price,
      AVG(prezzo_vendita_calcolato) as avg_price
    FROM master_file
    WHERE prezzo_vendita_calcolato IS NOT NULL
  `);

    stats.minPrice = parseFloat(rangeResult.rows[0].min_price || 0);
    stats.maxPrice = parseFloat(rangeResult.rows[0].max_price || 0);
    stats.averagePrice = parseFloat(rangeResult.rows[0].avg_price || 0);

    // Products by price rule type
    const byRuleResult = await query(`
    SELECT rm.tipo_regola, COUNT(*) as count
    FROM master_file mf
    LEFT JOIN regole_markup rm ON (
      (rm.tipo_regola = 'PRODOTTO_SPECIFICO' AND (rm.riferimento = mf.sku_selezionato OR rm.riferimento = mf.ean_gtin))
      OR (rm.tipo_regola = 'MARCA' AND LOWER(rm.riferimento) = LOWER(mf.marca))
      OR (rm.tipo_regola = 'CATEGORIA' AND LOWER(rm.riferimento) = LOWER(mf.categoria_ecommerce))
    )
    WHERE rm.attivo = true
    GROUP BY rm.tipo_regola
  `);

    stats.byRuleType = byRuleResult.rows;

    return stats;
}

module.exports = {
    calculatePrice,
    calculateAllPrices,
    findApplicableRule,
    applyMarkup,
    testPriceCalculation,
    getPricingStats
};
