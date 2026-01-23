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
        if (options.format.toLowerCase().includes('excel') || options.format.toLowerCase().includes('xls')) {
            return await this.parseExcel(options);
        }
        return await this.parseCSV(options);
    }

    private static async parseCSV(options: ParseOptions): Promise<ParseResult> {
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

    private static async parseExcel(options: ParseOptions): Promise<ParseResult> {
        const XLSX = await import('xlsx');
        const workbook = options.buffer ? XLSX.read(options.buffer, { type: 'buffer' }) : null;
        if (!workbook) throw new Error('Input Excel non valido');

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const results: any[] = [];
        for (const row of (jsonData as any[])) {
            if (options.onRow) await options.onRow(row);
            else results.push(row);
        }

        const headers = jsonData.length > 0 ? Object.keys(jsonData[0] as object) : [];

        return {
            headers,
            rows: options.previewRows ? results.slice(0, options.previewRows) : results,
            totalRows: jsonData.length
        };
    }
}
