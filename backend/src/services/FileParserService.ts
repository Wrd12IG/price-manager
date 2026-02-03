// @ts-nocheck
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
    skipLines?: number;
    onRow?: (row: any) => Promise<void>;
}

export class FileParserService {
    static async parseFile(options: ParseOptions): Promise<ParseResult> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            let headers: string[] = [];
            let isFirstRow = true;
            let useGeneratedHeaders = false;
            let rawHeaders: string[] = [];
            let rowCount = 0;
            const limit = options.previewRows || Infinity;

            const source = options.stream || (options.buffer ? Readable.from(options.buffer) : null);
            if (!source) return reject(new Error('Nessuna sorgente dati'));

            const quoteChar = options.quote === '' || options.quote === null ? '\0' : (options.quote || '"');

            // USIAMO SEMPRE HEADERS: FALSE per avere il controllo totale
            const parser = csv({
                separator: options.csvSeparator || ';',
                quote: quoteChar,
                headers: false,
                skipLines: options.skipLines || 0
            });

            const cleanup = () => {
                if (options.stream && (options.stream as any).destroy) {
                    (options.stream as any).destroy();
                }
            };

            source.pipe(parser)
                .on('data', async (data) => {
                    // data è un array o oggetto indicizzato numericamente
                    const values = Object.values(data).map(v => String(v).trim());

                    if (isFirstRow) {
                        isFirstRow = false;

                        // HEURISTIC: E' una intestazione valida?
                        // Criteri per "NON è intestazione":
                        // 1. Contiene numeri puri (es. "123", "45.67")
                        // 2. Contiene date (es. "2024-01-01")
                        // 3. Valori vuoti in colonne importanti (prima/seconda) ? (no, vago)
                        // 4. Testo troppo lungo (> 60 char) che sembra descrizione

                        const hasNumbers = values.some(v => /^\d+([.,]\d+)?$/.test(v) && v.length < 15); // escludi barcode lunghi che sembrano numeri
                        const hasDates = values.some(v => !isNaN(Date.parse(v)) && v.length > 5 && /[/-]/.test(v) && !/^\d+$/.test(v));
                        const hasLongText = values.some(v => v.length > 80);

                        if (hasNumbers || hasDates || hasLongText) {
                            // Sembrano dati! Generiamo headers generici
                            useGeneratedHeaders = true;
                            headers = values.map((_, i) => `Colonna ${i + 1}`);

                            // Aggiungi questa prima riga come dati
                            const rowObject: any = {};
                            headers.forEach((h, i) => { rowObject[h] = values[i] || ''; });
                            results.push(rowObject);
                            rowCount++;
                        } else {
                            // Sembrano intestazioni valide
                            headers = values;
                            // Non aggiungiamo ai risultati, è l'intestazione
                            return;
                        }
                    } else {
                        // Righe successive
                        rowCount++;

                        // Se abbiamo superato il limite PRIMA di processare
                        if (rowCount > limit) {
                            if (!options.onRow) {
                                source.unpipe(parser);
                                parser.end();
                                cleanup();
                                return;
                            }
                        }

                        const rowObject: any = {};
                        headers.forEach((h, i) => { rowObject[h] = values[i] || ''; });

                        if (options.onRow) {
                            parser.pause();
                            try {
                                await options.onRow(rowObject);
                            } catch (e) {
                                cleanup();
                                return reject(e);
                            }
                            parser.resume();
                        } else if (rowCount <= limit) {
                            results.push(rowObject);
                        }
                    }
                })
                .on('end', () => {
                    if (headers.length === 0 && results.length > 0) {
                        // Fallback estremo
                        headers = Object.keys(results[0]);
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
