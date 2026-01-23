import csv from 'csv-parser';
import { Readable } from 'stream';
import { logger } from '../utils/logger';

export interface ParseResult {
    headers: string[];
    rows: any[];
    totalRows: number;
}

export interface ParseOptions {
    format: string;
    stream?: Readable;
    buffer?: Buffer;
    encoding?: string;
    csvSeparator?: string;
    quote?: string;
    previewRows?: number;
    onRow?: (row: any) => Promise<void>;
}

export class FileParserService {
    static async parseFile(options: ParseOptions): Promise<ParseResult> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            let headers: string[] = [];
            let rowCount = 0;
            const limit = options.previewRows || Infinity;

            const source = options.stream || (options.buffer ? Readable.from(options.buffer) : null);
            if (!source) return reject(new Error('Nessuna sorgente dati'));

            const parser = csv({
                separator: options.csvSeparator || ';',
                quote: options.quote !== undefined ? options.quote : '"',
                mapHeaders: ({ header }) => header.trim()
            });

            const cleanup = () => {
                if (options.stream && (options.stream as any).destroy) {
                    (options.stream as any).destroy();
                }
            };

            source.pipe(parser)
                .on('headers', (h) => { headers = h; })
                .on('data', async (row) => {
                    rowCount++;
                    if (rowCount > limit) {
                        // Smettiamo di leggere se abbiamo superato il limite di anteprima
                        if (!options.onRow) {
                            source.unpipe(parser);
                            parser.end();
                            cleanup();
                            return;
                        }
                    }

                    if (options.onRow) {
                        parser.pause();
                        try {
                            await options.onRow(row);
                        } catch (e) {
                            cleanup();
                            return reject(e);
                        }
                        parser.resume();
                    } else if (rowCount <= limit) {
                        results.push(row);
                    }
                })
                .on('end', () => {
                    if (headers.length === 0 && rowCount > 0) {
                        // Se non abbiamo trovato header ma abbiamo righe, proviamo a generarli
                        headers = Object.keys(results[0] || {});
                    }
                    resolve({ headers, rows: results, totalRows: rowCount });
                })
                .on('error', (err) => {
                    logger.error(`Errore parsing file: ${err.message}`);
                    cleanup();
                    reject(err);
                });
        });
    }
}
