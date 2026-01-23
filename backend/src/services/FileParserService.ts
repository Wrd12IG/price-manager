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
    quote?: string;
    previewRows?: number;
    onRow?: (row: any) => Promise<void>; // Callback per lo streaming
}

export class FileParserService {

    static async parseFile(options: ParseOptions): Promise<ParseResult> {
        const { format } = options;
        try {
            switch (format.toLowerCase()) {
                case 'csv':
                case 'tsv':
                case 'txt':
                    return await this.parseCSV(options);
                case 'excel':
                case 'xlsx':
                case 'xls':
                    return await this.parseExcel(options);
                case 'xml':
                    return await this.parseXML(options);
                default:
                    throw new AppError(`Formato file non supportato: ${format}`, 400);
            }
        } catch (error: any) {
            logger.error(`Errore parsing file ${format}:`, error);
            throw new AppError(`Errore durante la lettura del file: ${error.message}`, 500);
        }
    }

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
                return reject(new Error('Nessun input fornito per CSV'));
            }

            const parser = csv({
                separator: options.csvSeparator || (options.format.toLowerCase() === 'csv' ? ';' : '\t'),
                quote: options.quote !== undefined ? options.quote : '"',
                mapHeaders: ({ header }) => header.trim()
            });

            stream.pipe(parser)
                .on('headers', (headerList) => {
                    headers = headerList;
                })
                .on('data', async (data) => {
                    rowCount++;
                    if (options.onRow) {
                        // Se c'è un callback (Streaming), non salviamo la riga in memoria
                        parser.pause();
                        try {
                            await options.onRow(data);
                        } catch (e) {
                            reject(e);
                        }
                        parser.resume();
                    } else if (rowCount <= limit) {
                        results.push(data);
                    }
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

    private static async parseExcel(options: ParseOptions): Promise<ParseResult> {
        let workbook: XLSX.WorkBook;
        if (options.buffer) {
            workbook = XLSX.read(options.buffer, { type: 'buffer' });
        } else if (options.filePath) {
            workbook = XLSX.readFile(options.filePath);
        } else {
            throw new Error('Nessun input fornito per Excel');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) return { headers: [], rows: [], totalRows: 0 };

        const headers = (jsonData[0] as any[]).map(h => h?.toString().trim());
        const allRows = jsonData.slice(1);
        const results: any[] = [];

        for (let i = 0; i < allRows.length; i++) {
            const rowArr = allRows[i] as any[];
            const rowObj: any = {};
            headers.forEach((header, index) => {
                rowObj[header] = rowArr[index];
            });

            if (options.onRow) {
                await options.onRow(rowObj);
            } else if (!options.previewRows || i < options.previewRows) {
                results.push(rowObj);
            }
        }

        return { headers, rows: results, totalRows: allRows.length };
    }

    // Le altre funzioni XML/JSON verranno gestite in modo simile se necessario,
    // ma CSV e Excel sono quelle critiche per la memoria.
    private static async parseXML(options: ParseOptions): Promise<ParseResult> {
        // Mock per ora, mantenendo la firma precedente ma alleggerito
        return { headers: [], rows: [], totalRows: 0 };
    }
}
