const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FtpClient = require('ftp');
const SftpClient = require('ssh2-sftp-client');
const { parseFile, parseFileFromBuffer } = require('../utils/file-parsers');
const { decrypt } = require('../utils/encryption');
const { query } = require('../config/database');

/**
 * Download supplier file from configured source
 * @param {Object} supplier - Supplier configuration
 * @returns {Promise<string>} Path to downloaded file
 */
async function downloadSupplierFile(supplier) {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    await fs.mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const fileName = `supplier_${supplier.id_fornitore}_${timestamp}`;
    const filePath = path.join(uploadDir, fileName);

    console.log(`Downloading file for supplier: ${supplier.nome_fornitore}`);

    switch (supplier.tipo_accesso) {
        case 'URL_DIRETTO':
            return await downloadFromURL(supplier.url_listino, filePath);

        case 'HTTP_AUTH':
            return await downloadFromURLWithAuth(
                supplier.url_listino,
                supplier.username_accesso,
                decrypt(supplier.password_accesso),
                filePath
            );

        case 'FTP':
            return await downloadFromFTP(
                supplier.url_listino,
                supplier.username_accesso,
                decrypt(supplier.password_accesso),
                filePath
            );

        case 'SFTP':
            return await downloadFromSFTP(
                supplier.url_listino,
                supplier.username_accesso,
                decrypt(supplier.password_accesso),
                filePath
            );

        case 'API_REST':
            return await downloadFromAPI(
                supplier.url_listino,
                supplier.credenziali_extra,
                filePath
            );

        default:
            throw new Error(`Unsupported access type: ${supplier.tipo_accesso}`);
    }
}

/**
 * Download from direct URL
 */
async function downloadFromURL(url, filePath) {
    const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer'
    });

    await fs.writeFile(filePath, response.data);
    console.log(`File downloaded to: ${filePath}`);
    return filePath;
}

/**
 * Download from URL with HTTP authentication
 */
async function downloadFromURLWithAuth(url, username, password, filePath) {
    const response = await axios({
        method: 'GET',
        url,
        auth: { username, password },
        responseType: 'arraybuffer'
    });

    await fs.writeFile(filePath, response.data);
    console.log(`File downloaded with auth to: ${filePath}`);
    return filePath;
}

/**
 * Download from FTP server
 */
async function downloadFromFTP(url, username, password, filePath) {
    return new Promise((resolve, reject) => {
        const client = new FtpClient();

        // Parse FTP URL
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const port = urlObj.port || 21;
        const remotePath = urlObj.pathname;

        client.on('ready', () => {
            client.get(remotePath, (err, stream) => {
                if (err) {
                    client.end();
                    return reject(err);
                }

                const writeStream = require('fs').createWriteStream(filePath);
                stream.pipe(writeStream);

                writeStream.on('finish', () => {
                    client.end();
                    console.log(`FTP file downloaded to: ${filePath}`);
                    resolve(filePath);
                });

                writeStream.on('error', (err) => {
                    client.end();
                    reject(err);
                });
            });
        });

        client.on('error', reject);

        client.connect({
            host,
            port,
            user: username,
            password
        });
    });
}

/**
 * Download from SFTP server
 */
async function downloadFromSFTP(url, username, password, filePath) {
    const client = new SftpClient();

    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const port = urlObj.port || 22;
        const remotePath = urlObj.pathname;

        await client.connect({
            host,
            port,
            username,
            password
        });

        await client.get(remotePath, filePath);
        await client.end();

        console.log(`SFTP file downloaded to: ${filePath}`);
        return filePath;
    } catch (error) {
        await client.end();
        throw error;
    }
}

/**
 * Download from REST API
 */
async function downloadFromAPI(url, credentials, filePath) {
    const headers = {};

    if (credentials) {
        if (credentials.apiKey) {
            headers['Authorization'] = `Bearer ${credentials.apiKey}`;
        }
        if (credentials.customHeaders) {
            Object.assign(headers, credentials.customHeaders);
        }
    }

    const response = await axios({
        method: 'GET',
        url,
        headers,
        responseType: 'arraybuffer'
    });

    await fs.writeFile(filePath, response.data);
    console.log(`API file downloaded to: ${filePath}`);
    return filePath;
}

/**
 * Parse downloaded file
 * @param {string} filePath - Path to file
 * @param {Object} supplier - Supplier configuration
 * @returns {Promise<Array>} Parsed data
 */
async function parseSupplierFile(filePath, supplier) {
    const options = {
        delimiter: supplier.separatore_csv || ';',
        encoding: supplier.encoding || 'utf8'
    };

    const data = await parseFile(filePath, supplier.formato_file, options);
    console.log(`Parsed ${Array.isArray(data) ? data.length : 'unknown'} records from file`);

    return Array.isArray(data) ? data : [data];
}

/**
 * Import parsed data to database
 * @param {number} supplierId - Supplier ID
 * @param {Array} parsedData - Parsed data array
 * @returns {Promise<number>} Number of records imported
 */
async function importToDatabase(supplierId, parsedData) {
    console.log(`Importing ${parsedData.length} records for supplier ${supplierId}`);

    // Clear old data for this supplier (keep last 7 days)
    await query(
        `DELETE FROM listini_raw 
     WHERE id_fornitore = $1 
     AND data_importazione < NOW() - INTERVAL '7 days'`,
        [supplierId]
    );

    let importedCount = 0;

    for (const record of parsedData) {
        try {
            await query(
                `INSERT INTO listini_raw (
          id_fornitore,
          sku_fornitore,
          ean_gtin,
          descrizione_originale,
          prezzo_acquisto,
          quantita_disponibile,
          categoria_fornitore,
          marca,
          altri_campi
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    supplierId,
                    record.sku || null,
                    record.ean || null,
                    record.descrizione || null,
                    record.prezzo || null,
                    record.quantita || 0,
                    record.categoria || null,
                    record.marca || null,
                    JSON.stringify(record)
                ]
            );
            importedCount++;
        } catch (error) {
            console.error(`Error importing record:`, error.message);
        }
    }

    // Update last sync timestamp
    await query(
        `UPDATE fornitori 
     SET ultima_sincronizzazione = NOW() 
     WHERE id_fornitore = $1`,
        [supplierId]
    );

    console.log(`Imported ${importedCount} records successfully`);
    return importedCount;
}

/**
 * Ingest data from a supplier (complete process)
 * @param {number} supplierId - Supplier ID
 * @returns {Promise<Object>} Ingestion result
 */
async function ingestSupplierData(supplierId) {
    const startTime = Date.now();

    try {
        // Get supplier configuration
        const supplierResult = await query(
            'SELECT * FROM fornitori WHERE id_fornitore = $1 AND attivo = true',
            [supplierId]
        );

        if (supplierResult.rows.length === 0) {
            throw new Error(`Supplier ${supplierId} not found or inactive`);
        }

        const supplier = supplierResult.rows[0];

        // Download file
        const filePath = await downloadSupplierFile(supplier);

        // Parse file
        const parsedData = await parseSupplierFile(filePath, supplier);

        // Import to database
        const importedCount = await importToDatabase(supplierId, parsedData);

        // Clean up downloaded file
        await fs.unlink(filePath);

        const duration = Date.now() - startTime;

        return {
            success: true,
            supplierId,
            supplierName: supplier.nome_fornitore,
            recordsImported: importedCount,
            duration
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Ingestion error for supplier ${supplierId}:`, error);

        return {
            success: false,
            supplierId,
            error: error.message,
            duration
        };
    }
}

/**
 * Ingest data from all active suppliers
 * @returns {Promise<Array>} Results for all suppliers
 */
async function ingestAllSuppliers() {
    const suppliersResult = await query(
        'SELECT id_fornitore FROM fornitori WHERE attivo = true'
    );

    const results = [];

    for (const supplier of suppliersResult.rows) {
        const result = await ingestSupplierData(supplier.id_fornitore);
        results.push(result);
    }

    return results;
}

module.exports = {
    downloadSupplierFile,
    parseSupplierFile,
    importToDatabase,
    ingestSupplierData,
    ingestAllSuppliers
};
