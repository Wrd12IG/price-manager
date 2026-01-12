/**
 * Validation utilities for data integrity
 */

/**
 * Validate EAN/GTIN code
 * @param {string} ean - EAN/GTIN code
 * @returns {boolean} True if valid
 */
function isValidEAN(ean) {
    if (!ean) return false;

    // Remove any whitespace
    ean = ean.toString().trim();

    // EAN can be 8, 13, or 14 digits
    if (!/^\d{8}$|^\d{13}$|^\d{14}$/.test(ean)) {
        return false;
    }

    return true;
}

/**
 * Normalize EAN by padding with zeros
 * @param {string} ean - EAN code
 * @param {number} length - Target length (default 13)
 * @returns {string} Normalized EAN
 */
function normalizeEAN(ean, length = 13) {
    if (!ean) return null;

    ean = ean.toString().trim().replace(/\D/g, ''); // Remove non-digits

    if (ean.length > length) {
        return ean.substring(0, length);
    }

    return ean.padStart(length, '0');
}

/**
 * Validate price
 * @param {any} price - Price value
 * @returns {boolean} True if valid
 */
function isValidPrice(price) {
    if (price === null || price === undefined || price === '') return false;

    const numPrice = parseFloat(price);
    return !isNaN(numPrice) && numPrice >= 0;
}

/**
 * Parse price from various formats
 * @param {any} price - Price in various formats
 * @returns {number|null} Parsed price or null
 */
function parsePrice(price) {
    if (price === null || price === undefined || price === '') return null;

    // Convert to string and handle European format (comma as decimal separator)
    let priceStr = price.toString().trim();

    // Replace comma with dot for decimal
    priceStr = priceStr.replace(',', '.');

    // Remove any currency symbols and spaces
    priceStr = priceStr.replace(/[€$£\s]/g, '');

    const parsed = parseFloat(priceStr);

    return isNaN(parsed) ? null : Math.round(parsed * 100) / 100; // Round to 2 decimals
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidURL(url) {
    if (!url) return false;

    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Validate email
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
    if (!email) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize string (trim, remove extra spaces)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
    if (!str) return '';

    return str.toString().trim().replace(/\s+/g, ' ');
}

/**
 * Validate quantity
 * @param {any} qty - Quantity value
 * @returns {boolean} True if valid
 */
function isValidQuantity(qty) {
    if (qty === null || qty === undefined || qty === '') return false;

    const numQty = parseInt(qty);
    return !isNaN(numQty) && numQty >= 0;
}

/**
 * Parse quantity
 * @param {any} qty - Quantity in various formats
 * @returns {number} Parsed quantity
 */
function parseQuantity(qty) {
    if (qty === null || qty === undefined || qty === '') return 0;

    const parsed = parseInt(qty);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Validate SKU
 * @param {string} sku - SKU to validate
 * @returns {boolean} True if valid
 */
function isValidSKU(sku) {
    if (!sku) return false;

    // SKU should be alphanumeric with possible hyphens, underscores
    return /^[a-zA-Z0-9_-]+$/.test(sku.trim());
}

/**
 * Generate Shopify handle from product name
 * @param {string} name - Product name
 * @returns {string} URL-friendly handle
 */
function generateHandle(name) {
    if (!name) return '';

    return name
        .toLowerCase()
        .trim()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

module.exports = {
    isValidEAN,
    normalizeEAN,
    isValidPrice,
    parsePrice,
    isValidURL,
    isValidEmail,
    sanitizeString,
    isValidQuantity,
    parseQuantity,
    isValidSKU,
    generateHandle
};
