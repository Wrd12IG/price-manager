const axios = require('axios');
const { query } = require('../config/database');

/**
 * Enrich product with ICecat data
 * @param {string} ean - Product EAN/GTIN
 * @returns {Promise<Object>} ICecat data
 */
async function enrichWithIcecat(ean) {
    try {
        // Get ICecat credentials from configuration
        const configResult = await query(`
      SELECT chiave, valore FROM configurazione_sistema
      WHERE chiave IN ('ICECAT_USERNAME', 'ICECAT_API_KEY', 'ICECAT_LANGUAGE')
    `);

        const config = {};
        configResult.rows.forEach(row => {
            config[row.chiave] = row.valore;
        });

        if (!config.ICECAT_USERNAME || !config.ICECAT_API_KEY) {
            console.warn('ICecat credentials not configured');
            return null;
        }

        const language = config.ICECAT_LANGUAGE || 'IT';

        // Call ICecat API
        const response = await axios.get(
            `https://live.icecat.biz/api/?UserName=${config.ICECAT_USERNAME}&Language=${language}&GTIN=${ean}`,
            {
                headers: {
                    'Authorization': `Bearer ${config.ICECAT_API_KEY}`
                },
                timeout: 10000
            }
        );

        const data = response.data;

        if (!data || !data.data) {
            console.log(`No ICecat data found for EAN: ${ean}`);
            return null;
        }

        // Extract relevant data
        const productData = data.data;

        const icecatData = {
            ean_gtin: ean,
            descrizione_breve: productData.GeneralInfo?.Title || null,
            descrizione_lunga: productData.GeneralInfo?.Description || null,
            specifiche_tecniche: productData.FeaturesGroups || {},
            url_immagini: productData.Gallery?.map(img => img.Pic) || [],
            url_scheda_pdf: productData.GeneralInfo?.ProductPDF || null,
            categoria_icecat: productData.Category?.Name || null
        };

        // Save to database
        await query(`
      INSERT INTO dati_icecat (
        ean_gtin, descrizione_breve, descrizione_lunga,
        specifiche_tecniche, url_immagini, url_scheda_pdf, categoria_icecat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (ean_gtin) DO UPDATE SET
        descrizione_breve = EXCLUDED.descrizione_breve,
        descrizione_lunga = EXCLUDED.descrizione_lunga,
        specifiche_tecniche = EXCLUDED.specifiche_tecniche,
        url_immagini = EXCLUDED.url_immagini,
        url_scheda_pdf = EXCLUDED.url_scheda_pdf,
        categoria_icecat = EXCLUDED.categoria_icecat,
        updated_at = NOW()
    `, [
            icecatData.ean_gtin,
            icecatData.descrizione_breve,
            icecatData.descrizione_lunga,
            JSON.stringify(icecatData.specifiche_tecniche),
            JSON.stringify(icecatData.url_immagini),
            icecatData.url_scheda_pdf,
            icecatData.categoria_icecat
        ]);

        return icecatData;
    } catch (error) {
        console.error(`ICecat enrichment error for ${ean}:`, error.message);
        return null;
    }
}

/**
 * Enrich all products in master_file with ICecat data
 * @param {number} limit - Maximum products to process (default: all)
 * @returns {Promise<Object>} Enrichment result
 */
async function enrichAllProducts(limit = null) {
    console.log('Starting ICecat enrichment...');

    const startTime = Date.now();

    try {
        // Get products without ICecat data
        let queryText = `
      SELECT mf.ean_gtin
      FROM master_file mf
      LEFT JOIN dati_icecat di ON mf.ean_gtin = di.ean_gtin
      WHERE di.ean_gtin IS NULL
    `;

        if (limit) {
            queryText += ` LIMIT ${limit}`;
        }

        const productsResult = await query(queryText);
        const products = productsResult.rows;

        console.log(`Enriching ${products.length} products with ICecat data`);

        let enrichedCount = 0;
        let failedCount = 0;

        for (const product of products) {
            const result = await enrichWithIcecat(product.ean_gtin);

            if (result) {
                enrichedCount++;
            } else {
                failedCount++;
            }

            // Rate limiting: wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const duration = Date.now() - startTime;

        console.log(`ICecat enrichment complete: ${enrichedCount} success, ${failedCount} failed`);

        return {
            success: true,
            enrichedCount,
            failedCount,
            duration
        };
    } catch (error) {
        console.error('ICecat enrichment error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    enrichWithIcecat,
    enrichAllProducts
};
