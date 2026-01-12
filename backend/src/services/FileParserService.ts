import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import xml2js from 'xml2js';
import fs from 'fs';
import { Readable } from 'stream';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ParseResult {
    headers: string[];
    rows: any[];
    totalRows: number;
}

export interface ParseOptions {
    format: string;
    filePath?: string;
    buffer?: Buffer;
    encoding?: string;
    csvSeparator?: string;
    quote?: string; // Nuova opzione per gestire il quoting
    previewRows?: number; // Se definito, ferma il parsing dopo N righe
}

export class FileParserService {

    /**
     * Metodo principale per parsare un file
     */
    static async parseFile(options: ParseOptions): Promise<ParseResult> {
        const { format } = options;

        try {
            switch (format.toLowerCase()) {
                case 'csv':
                    return await this.parseCSV(options);
                case 'tsv':
                case 'txt':
                    // TSV e TXT usano tab come separatore di default, ma rispettiamo l'opzione se presente
                    return await this.parseCSV({ ...options, csvSeparator: options.csvSeparator || '\t' });
                case 'excel':
                case 'xlsx':
                case 'xls':
                    return await this.parseExcel(options);
                case 'xml':
                    return await this.parseXML(options);
                case 'json':
                    return await this.parseJSON(options);
                default:
                    throw new AppError(`Formato file non supportato: ${format}`, 400);
            }
        } catch (error: any) {
            logger.error(`Errore parsing file ${format}:`, error);
            throw new AppError(`Errore durante la lettura del file: ${error.message}`, 500);
        }
    }

    /**
     * Parsing CSV
     */
    private static parseCSV(options: ParseOptions): Promise<ParseResult> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            let headers: string[] = [];
            let rowCount = 0;
            const limit = options.previewRows || Infinity;

            let stream: Readable;

            if (options.buffer) {
                stream = Readable.from(options.buffer);
            } else if (options.filePath) {
                stream = fs.createReadStream(options.filePath);
            } else {
                return reject(new Error('Nessun input (filePath o buffer) fornito per CSV'));
            }

            stream
                .pipe(csv({
                    separator: options.csvSeparator || ';',
                    quote: options.quote !== undefined ? options.quote : '"', // Supporto custom quote
                    mapHeaders: ({ header }) => header.trim()
                }))
                .on('headers', (headerList) => {
                    headers = headerList;
                })
                .on('data', (data) => {
                    if (rowCount < limit) {
                        results.push(data);
                    }
                    rowCount++;
                })
                .on('end', () => {
                    resolve({
                        headers,
                        rows: results,
                        totalRows: rowCount
                    });
                })
                .on('error', (error) => reject(error));
        });
    }

    /**
     * Parsing Excel (XLSX, XLS)
     */
    private static async parseExcel(options: ParseOptions): Promise<ParseResult> {
        let workbook: XLSX.WorkBook;

        if (options.buffer) {
            workbook = XLSX.read(options.buffer, { type: 'buffer' });
        } else if (options.filePath) {
            workbook = XLSX.readFile(options.filePath);
        } else {
            throw new Error('Nessun input fornito per Excel');
        }

        // Prendi il primo foglio
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converti in JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // header: 1 restituisce array di array

        if (jsonData.length === 0) {
            return { headers: [], rows: [], totalRows: 0 };
        }

        // Estrai headers (prima riga)
        const headers = (jsonData[0] as string[]).map(h => h?.toString().trim());

        // Estrai righe
        const allRows = jsonData.slice(1);
        const totalRows = allRows.length;

        // Limita per preview se necessario
        const limit = options.previewRows || totalRows;
        const rowsRaw = allRows.slice(0, limit);

        // Mappa le righe in oggetti usando gli headers
        const rows = rowsRaw.map((row: any) => {
            const rowObj: any = {};
            headers.forEach((header, index) => {
                rowObj[header] = row[index];
            });
            return rowObj;
        });

        return {
            headers,
            rows,
            totalRows
        };
    }

    /**
     * Parsing XML
     */
    private static async parseXML(options: ParseOptions): Promise<ParseResult> {
        let xmlContent: string;

        if (options.buffer) {
            xmlContent = options.buffer.toString(options.encoding as BufferEncoding || 'utf-8');
        } else if (options.filePath) {
            xmlContent = fs.readFileSync(options.filePath, options.encoding as BufferEncoding || 'utf-8');
        } else {
            throw new Error('Nessun input fornito per XML');
        }

        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlContent);

        // Logica euristica per trovare l'array dei prodotti
        // Cerca la prima proprietà che è un array
        let products: any[] = [];

        const findArray = (obj: any): any[] | null => {
            for (const key in obj) {
                if (Array.isArray(obj[key])) {
                    return obj[key];
                }
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const found = findArray(obj[key]);
                    if (found) return found;
                }
            }
            return null;
        };

        // Se la root stessa è l'array (raro in XML valido ma possibile in conversioni) o contiene l'array
        // Spesso XML è tipo <Catalog><Product>...</Product><Product>...</Product></Catalog>
        // xml2js converte in { Catalog: { Product: [...] } }

        // Tentativo 1: Cerca ricorsivamente un array
        const foundArray = findArray(result);
        if (foundArray) {
            products = foundArray;
        } else {
            // Tentativo 2: Forse è un singolo oggetto ripetuto che xml2js non ha messo in array se ce n'è uno solo?
            // Per ora assumiamo che troviamo un array o falliamo gracefully
            // Potremmo dover raffinare questa logica in base ai file reali
            logger.warn('Nessun array di prodotti trovato nel file XML, struttura:', Object.keys(result));
        }

        const totalRows = products.length;
        const limit = options.previewRows || totalRows;
        const rows = products.slice(0, limit);

        // Estrai headers dal primo elemento
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

        return {
            headers,
            rows,
            totalRows
        };
    }

    /**
     * Parsing JSON
     */
    private static async parseJSON(options: ParseOptions): Promise<ParseResult> {
        let jsonContent: string;

        if (options.buffer) {
            jsonContent = options.buffer.toString(options.encoding as BufferEncoding || 'utf-8');
        } else if (options.filePath) {
            jsonContent = fs.readFileSync(options.filePath, options.encoding as BufferEncoding || 'utf-8');
        } else {
            throw new Error('Nessun input fornito per JSON');
        }

        let data = JSON.parse(jsonContent);
        let rows: any[] = [];

        if (Array.isArray(data)) {
            rows = data;
        } else if (typeof data === 'object' && data !== null) {
            // Cerca una proprietà che sia un array
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    rows = data[key];
                    break;
                }
            }
        }

        const totalRows = rows.length;
        const limit = options.previewRows || totalRows;
        const slicedRows = rows.slice(0, limit);
        const headers = slicedRows.length > 0 ? Object.keys(slicedRows[0]) : [];

        return {
            headers,
            rows: slicedRows,
            totalRows
        };
    }
}
