const { query } = require('../config/database');
const {
    normalizeEAN,
    parsePrice,
    parseQuantity,
    sanitizeString
} = require('../utils/validators');

/**
 * Apply field mappings to raw supplier data
 * @param {number} supplierId - Supplier ID
 * @returns {Promise<Object>} Normalization result
 */
async function normalizeSupplierData(supplierId) {
    console.log(`Normalizing data for supplier ${supplierId}`);

    try {
        // Get field mappings for this supplier
        const mappingsResult = await query(
            `SELECT * FROM mappatura_campi 
       WHERE id_fornitore = $1 
       ORDER BY ordine_priorita`,
            [supplierId]
        );

        const fieldMappings = mappingsResult.rows;

        if (fieldMappings.length === 0) {
            console.warn(`No field mappings found for supplier ${supplierId}`);
            return { success: false, error: 'No field mappings configured' };
        }

        // Get category mappings
        const categoryMappingsResult = await query(
            `SELECT * FROM mappatura_categorie 
       WHERE id_fornitore = $1`,
            [supplierId]
        );

        const categoryMappings = categoryMappingsResult.rows;

        // Get raw data for this supplier (latest import only)
        const rawDataResult = await query(
            `SELECT * FROM listini_raw 
       WHERE id_fornitore = $1 
       AND data_importazione = (
         SELECT MAX(data_importazione) 
         FROM listini_raw 
         WHERE id_fornitore = $1
       )`,
            [supplierId]
        );

        const rawRecords = rawDataResult.rows;
        console.log(`Processing ${rawRecords.length} raw records`);

        let normalizedCount = 0;

        for (const rawRecord of rawRecords) {
            try {
                // Parse the altri_campi JSON to get original field names
                const originalData = rawRecord.altri_campi || {};

                // Apply field mappings
                const normalized = applyFieldMappings(originalData, fieldMappings);

                // Apply category mapping
                if (normalized.categoria_fornitore) {
                    normalized.categoria_ecommerce = applyCategoryMapping(
                        normalized.categoria_fornitore,
                        categoryMappings
                    );
                }

                // Update the raw record with normalized data
                await query(
                    `UPDATE listini_raw SET
            sku_fornitore = $1,
            ean_gtin = $2,
            descrizione_originale = $3,
            prezzo_acquisto = $4,
            quantita_disponibile = $5,
            categoria_fornitore = $6,
            marca = $7
           WHERE id_record = $8`,
                    [
                        normalized.sku_fornitore,
                        normalized.ean_gtin,
                        normalized.descrizione_originale,
                        normalized.prezzo_acquisto,
                        normalized.quantita_disponibile,
                        normalized.categoria_fornitore,
                        normalized.marca,
                        rawRecord.id_record
                    ]
                );

                normalizedCount++;
            } catch (error) {
                console.error(`Error normalizing record ${rawRecord.id_record}:`, error.message);
            }
        }

        console.log(`Normalized ${normalizedCount} records`);

        return {
            success: true,
            supplierId,
            recordsNormalized: normalizedCount
        };
    } catch (error) {
        console.error(`Normalization error for supplier ${supplierId}:`, error);
        return {
            success: false,
            supplierId,
            error: error.message
        };
    }
}

/**
 * Apply field mappings to a single record
 * @param {Object} originalData - Original data from supplier
 * @param {Array} fieldMappings - Field mapping rules
 * @returns {Object} Normalized data
 */
function applyFieldMappings(originalData, fieldMappings) {
    const normalized = {
        sku_fornitore: null,
        ean_gtin: null,
        descrizione_originale: null,
        prezzo_acquisto: null,
        quantita_disponibile: 0,
        categoria_fornitore: null,
        marca: null
    };

    for (const mapping of fieldMappings) {
        const originalValue = originalData[mapping.campo_originale];

        if (originalValue === undefined || originalValue === null) {
            continue;
        }

        let transformedValue = originalValue;

        // Apply transformations
        if (mapping.trasformazione_richiesta) {
            transformedValue = applyTransformation(
                originalValue,
                mapping.trasformazione_richiesta
            );
        }

        // Map to standard field
        switch (mapping.campo_standard) {
            case 'SKU_Fornitore':
                normalized.sku_fornitore = sanitizeString(transformedValue);
                break;

            case 'EAN_GTIN':
                normalized.ean_gtin = normalizeEAN(transformedValue);
                break;

            case 'Descrizione_Prodotto':
                normalized.descrizione_originale = sanitizeString(transformedValue);
                break;

            case 'Prezzo_Acquisto':
                normalized.prezzo_acquisto = parsePrice(transformedValue);
                break;

            case 'Quantita':
                normalized.quantita_disponibile = parseQuantity(transformedValue);
                break;

            case 'Categoria_Fornitore':
                normalized.categoria_fornitore = sanitizeString(transformedValue);
                break;

            case 'Marca':
                normalized.marca = sanitizeString(transformedValue);
                break;
        }
    }

    return normalized;
}

/**
 * Apply transformation to a value
 * @param {any} value - Original value
 * @param {string} transformation - Transformation type
 * @returns {any} Transformed value
 */
function applyTransformation(value, transformation) {
    if (!value) return value;

    const transformations = transformation.split(',').map(t => t.trim());

    let result = value;

    for (const transform of transformations) {
        switch (transform.toLowerCase()) {
            case 'trim':
                result = typeof result === 'string' ? result.trim() : result;
                break;

            case 'uppercase':
                result = typeof result === 'string' ? result.toUpperCase() : result;
                break;

            case 'lowercase':
                result = typeof result === 'string' ? result.toLowerCase() : result;
                break;

            case 'normalize_ean':
                result = normalizeEAN(result);
                break;

            case 'remove_spaces':
                result = typeof result === 'string' ? result.replace(/\s+/g, '') : result;
                break;

            case 'parse_price':
                result = parsePrice(result);
                break;

            case 'parse_quantity':
                result = parseQuantity(result);
                break;
        }
    }

    return result;
}

/**
 * Apply category mapping
 * @param {string} supplierCategory - Category from supplier
 * @param {Array} categoryMappings - Category mapping rules
 * @returns {string|null} Mapped e-commerce category
 */
function applyCategoryMapping(supplierCategory, categoryMappings) {
    if (!supplierCategory) return null;

    // Find exact match first
    const exactMatch = categoryMappings.find(
        m => m.categoria_fornitore.toLowerCase() === supplierCategory.toLowerCase()
    );

    if (exactMatch) {
        return exactMatch.categoria_ecommerce;
    }

    // Try partial match (supplier category contains mapping key)
    const partialMatch = categoryMappings.find(
        m => supplierCategory.toLowerCase().includes(m.categoria_fornitore.toLowerCase())
    );

    if (partialMatch) {
        return partialMatch.categoria_ecommerce;
    }

    // No mapping found
    console.warn(`No category mapping found for: ${supplierCategory}`);
    return null;
}

/**
 * Normalize data for all suppliers
 * @returns {Promise<Array>} Results for all suppliers
 */
async function normalizeAllSuppliers() {
    const suppliersResult = await query(
        'SELECT id_fornitore FROM fornitori WHERE attivo = true'
    );

    const results = [];

    for (const supplier of suppliersResult.rows) {
        const result = await normalizeSupplierData(supplier.id_fornitore);
        results.push(result);
    }

    return results;
}

/**
 * Get unmapped products for a supplier
 * @param {number} supplierId - Supplier ID
 * @returns {Promise<Array>} Unmapped products
 */
async function getUnmappedProducts(supplierId) {
    const result = await query(
        `SELECT DISTINCT categoria_fornitore, COUNT(*) as count
     FROM listini_raw
     WHERE id_fornitore = $1
     AND categoria_fornitore IS NOT NULL
     AND categoria_fornitore NOT IN (
       SELECT categoria_fornitore 
       FROM mappatura_categorie 
       WHERE id_fornitore = $1
     )
     GROUP BY categoria_fornitore
     ORDER BY count DESC`,
        [supplierId]
    );

    return result.rows;
}

module.exports = {
    normalizeSupplierData,
    normalizeAllSuppliers,
    applyFieldMappings,
    applyCategoryMapping,
    getUnmappedProducts
};
