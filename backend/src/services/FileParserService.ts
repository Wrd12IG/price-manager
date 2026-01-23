import csv from 'csv-parser';
import { Readable } from 'stream';

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

            source.pipe(parser)
                .on('headers', (h) => { headers = h; })
                .on('data', async (row) => {
                    rowCount++;
                    if (options.onRow) {
                        // BACKPRESSURE: Fermiamo il flusso finché il DB non ha finito
                        parser.pause();
                        try {
                            await options.onRow(row);
                        } catch (e) {
                            return reject(e);
                        }
                        parser.resume();
                    } else if (rowCount <= limit) {
                        results.push(row);
                    }
                })
                .on('end', () => resolve({ headers, rows: results, totalRows: rowCount }))
                .on('error', reject);
        });
    }
}
