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
    csvSeparator?: string;
    quote?: string;
    previewRows?: number;
    onRow?: (row: any) => Promise<void>;
}

export class FileParserService {
    static async parseFile(options: ParseOptions): Promise<ParseResult> {
        // Se è Excel usiamo XLSX (che purtroppo richiede memoria, ma per CSV/XML usiamo streaming puro)
        if (options.format.toLowerCase().includes('excel') || options.format.toLowerCase().includes('xls')) {
            const XLSX = await import('xlsx');
            const workbook = options.buffer ? XLSX.read(options.buffer, { type: 'buffer' }) : null;
            if (!workbook) throw new Error('Dati Excel non validi');
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            const headers = data.length > 0 ? Object.keys(data[0] as object) : [];
            for (const row of (data as any[])) {
                if (options.onRow) await options.onRow(row);
            }
            return { headers, rows: options.onRow ? [] : data, totalRows: data.length };
        }

        // CSV/TSV/TXT STREAMING (RAM ZERO)
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            let headers: string[] = [];
            let rowCount = 0;
            const limit = options.previewRows || Infinity;

            const source = options.stream || (options.buffer ? Readable.from(options.buffer) : null);
            if (!source) return reject(new Error('Nessuna sorgente dati fornita'));

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
                        parser.pause();
                        await options.onRow(row).catch(reject);
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
