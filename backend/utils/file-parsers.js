const csv = require('csv-parser');
const XLSX = require('xlsx');
const xml2js = require('xml2js');
const fs = require('fs');
const { Readable } = require('stream');

/**
 * Parse CSV file
 * @param {string} filePath - Path to CSV file
 * @param {string} delimiter - CSV delimiter (default: ';')
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<Array>} Parsed data as array of objects
 */
async function parseCSV(filePath, delimiter = ';', encoding = 'utf8') {
    return new Promise((resolve, reject) => {
        const results = [];

        fs.createReadStream(filePath, { encoding })
            .pipe(csv({ separator: delimiter }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Parse CSV from buffer
 * @param {Buffer} buffer - CSV file buffer
 * @param {string} delimiter - CSV delimiter
 * @param {string} encoding - File encoding
 * @returns {Promise<Array>} Parsed data
 */
async function parseCSVFromBuffer(buffer, delimiter = ';', encoding = 'utf8') {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString(encoding));

        stream
            .pipe(csv({ separator: delimiter }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

/**
 * Parse Excel file (XLSX, XLS)
 * @param {string} filePath - Path to Excel file
 * @param {string} sheetName - Sheet name (optional, uses first sheet if not specified)
 * @returns {Array} Parsed data as array of objects
 */
function parseExcel(filePath, sheetName = null) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheet = sheetName
            ? workbook.Sheets[sheetName]
            : workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet) {
            throw new Error(`Sheet ${sheetName || 'first sheet'} not found`);
        }

        return XLSX.utils.sheet_to_json(sheet);
    } catch (error) {
        console.error('Excel parsing error:', error);
        throw error;
    }
}

/**
 * Parse Excel from buffer
 * @param {Buffer} buffer - Excel file buffer
 * @param {string} sheetName - Sheet name (optional)
 * @returns {Array} Parsed data
 */
function parseExcelFromBuffer(buffer, sheetName = null) {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = sheetName
            ? workbook.Sheets[sheetName]
            : workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet) {
            throw new Error(`Sheet ${sheetName || 'first sheet'} not found`);
        }

        return XLSX.utils.sheet_to_json(sheet);
    } catch (error) {
        console.error('Excel parsing error:', error);
        throw error;
    }
}

/**
 * Parse XML file
 * @param {string} filePath - Path to XML file
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<Object>} Parsed XML as JavaScript object
 */
async function parseXML(filePath, encoding = 'utf8') {
    try {
        const xmlData = fs.readFileSync(filePath, encoding);
        const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true
        });

        return await parser.parseStringPromise(xmlData);
    } catch (error) {
        console.error('XML parsing error:', error);
        throw error;
    }
}

/**
 * Parse XML from buffer
 * @param {Buffer} buffer - XML file buffer
 * @param {string} encoding - File encoding
 * @returns {Promise<Object>} Parsed XML
 */
async function parseXMLFromBuffer(buffer, encoding = 'utf8') {
    try {
        const xmlData = buffer.toString(encoding);
        const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true
        });

        return await parser.parseStringPromise(xmlData);
    } catch (error) {
        console.error('XML parsing error:', error);
        throw error;
    }
}

/**
 * Parse JSON file
 * @param {string} filePath - Path to JSON file
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Object|Array} Parsed JSON
 */
function parseJSON(filePath, encoding = 'utf8') {
    try {
        const jsonData = fs.readFileSync(filePath, encoding);
        return JSON.parse(jsonData);
    } catch (error) {
        console.error('JSON parsing error:', error);
        throw error;
    }
}

/**
 * Parse JSON from buffer
 * @param {Buffer} buffer - JSON file buffer
 * @param {string} encoding - File encoding
 * @returns {Object|Array} Parsed JSON
 */
function parseJSONFromBuffer(buffer, encoding = 'utf8') {
    try {
        const jsonData = buffer.toString(encoding);
        return JSON.parse(jsonData);
    } catch (error) {
        console.error('JSON parsing error:', error);
        throw error;
    }
}

/**
 * Parse TSV file (Tab-Separated Values)
 * @param {string} filePath - Path to TSV file
 * @param {string} encoding - File encoding (default: 'utf8')
 * @returns {Promise<Array>} Parsed data
 */
async function parseTSV(filePath, encoding = 'utf8') {
    return parseCSV(filePath, '\t', encoding);
}

/**
 * Parse TSV from buffer
 * @param {Buffer} buffer - TSV file buffer
 * @param {string} encoding - File encoding
 * @returns {Promise<Array>} Parsed data
 */
async function parseTSVFromBuffer(buffer, encoding = 'utf8') {
    return parseCSVFromBuffer(buffer, '\t', encoding);
}

/**
 * Auto-detect format and parse file
 * @param {string} filePath - Path to file
 * @param {string} format - File format (CSV, EXCEL, XML, JSON, TSV)
 * @param {Object} options - Parsing options
 * @returns {Promise<Array|Object>} Parsed data
 */
async function parseFile(filePath, format, options = {}) {
    const { delimiter = ';', encoding = 'utf8', sheetName = null } = options;

    switch (format.toUpperCase()) {
        case 'CSV':
            return await parseCSV(filePath, delimiter, encoding);

        case 'EXCEL':
        case 'XLSX':
        case 'XLS':
            return parseExcel(filePath, sheetName);

        case 'XML':
            return await parseXML(filePath, encoding);

        case 'JSON':
            return parseJSON(filePath, encoding);

        case 'TSV':
            return await parseTSV(filePath, encoding);

        default:
            throw new Error(`Unsupported file format: ${format}`);
    }
}

/**
 * Parse file from buffer
 * @param {Buffer} buffer - File buffer
 * @param {string} format - File format
 * @param {Object} options - Parsing options
 * @returns {Promise<Array|Object>} Parsed data
 */
async function parseFileFromBuffer(buffer, format, options = {}) {
    const { delimiter = ';', encoding = 'utf8', sheetName = null } = options;

    switch (format.toUpperCase()) {
        case 'CSV':
            return await parseCSVFromBuffer(buffer, delimiter, encoding);

        case 'EXCEL':
        case 'XLSX':
        case 'XLS':
            return parseExcelFromBuffer(buffer, sheetName);

        case 'XML':
            return await parseXMLFromBuffer(buffer, encoding);

        case 'JSON':
            return parseJSONFromBuffer(buffer, encoding);

        case 'TSV':
            return await parseTSVFromBuffer(buffer, encoding);

        default:
            throw new Error(`Unsupported file format: ${format}`);
    }
}

module.exports = {
    parseCSV,
    parseCSVFromBuffer,
    parseExcel,
    parseExcelFromBuffer,
    parseXML,
    parseXMLFromBuffer,
    parseJSON,
    parseJSONFromBuffer,
    parseTSV,
    parseTSVFromBuffer,
    parseFile,
    parseFileFromBuffer
};
