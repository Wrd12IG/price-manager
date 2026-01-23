import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { Readable } from 'stream';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ParseOptions {
    format: string;
    stream?: Readable;
    buffer?: Buffer;
    csvSeparator?: string;
    quote?: string;
    onRow?: (row: any) => Promise<void>;
}

export class FileParserService {
    static async parseFile(options: ParseOptions): Promise<{ totalRows: number }> {
        if (options.format.toLowerCase().includes('excel') || options.format.toLowerCase().includes('xls')) {
            return await this.parseExcel(options);
        }
        return await this.parseCSV(options);
    }

    private static async parseCSV(options: ParseOptions): Promise<{ totalRows: number }> {
        return new Promise((resolve, reject) => {
            let rowCount = 0;
            const source = options.stream || (options.buffer ? Readable.from(options.buffer) : null);

            if (!source) return reject(new Error('Nessuna sorgente dati'));

            const parser = csv({
                separator: options.csvSeparator || ';',
                quote: options.quote !== undefined ? options.quote : '"',
                mapHeaders: ({ header }) => header.trim()
            });

            // Usiamo un flag per gestire il backpressure (evitare crash di memoria)
            let isProcessing = false;

            source.pipe(parser)
                .on('data', async (row) => {
                    rowCount++;
                    if (options.onRow) {
                        if (isProcessing) parser.pause();
                        isProcessing = true;
                        try {
                            await options.onRow(row);
                        } catch (e) {
                            source.unpipe(parser);
                            return reject(e);
                        }
                        isProcessing = false;
                        parser.resume();
                    }
                })
                .on('end', () => resolve({ totalRows: rowCount }))
                .on('error', (err) => reject(err));
        });
    }

    private static async parseExcel(options: ParseOptions): Promise<{ totalRows: number }> {
        const XLSX = await import('xlsx');
        const workbook = options.buffer ? XLSX.read(options.buffer, { type: 'buffer' }) : null;
        if (!workbook) throw new Error('Input Excel non valido');

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        for (const row of data) {
            if (options.onRow) await options.onRow(row);
        }
        return { totalRows: data.length };
    }
}
