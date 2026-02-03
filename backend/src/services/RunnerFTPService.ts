// @ts-nocheck
import { FTPService } from './FTPService';
import { FileParserService } from './FileParserService';
import { FileMergeService } from './FileMergeService';
import { logger } from '../utils/logger';

export interface FTPFileConfig {
    directory: string;
    filename: string;
}

export class RunnerFTPService {
    /**
     * Scarica e unisce i file specifici per Runner Tech Store
     * - articoli.txt (root)
     * - arrivi.txt (root)
     * - prezzi.txt (/C200835)
     */
    static async downloadAndMergeRunnerFiles(config: {
        host: string;
        port: number;
        user: string;
        password: string;
    }): Promise<any[]> {
        const filesToDownload: FTPFileConfig[] = [
            { directory: '/', filename: 'articoli.txt' },
            { directory: '/', filename: 'arrivi.txt' },
            { directory: '/', filename: 'descp.txt' },
            { directory: '/', filename: 'immagini.txt' },
            { directory: '/', filename: 'peso.txt' },
            { directory: '/C200835', filename: 'prezzi.txt' },
            { directory: '/C200835', filename: 'prezzi_no_sconto.txt' }
        ];

        logger.info(`Scaricamento file specifici Runner: ${filesToDownload.map(f => f.filename).join(', ')}`);

        // Scarica i file specifici
        const files: Array<{ filename: string; buffer: Buffer }> = [];
        for (const fileConfig of filesToDownload) {
            try {
                const file = await FTPService.downloadSpecificFile({
                    ...config,
                    directory: fileConfig.directory,
                    filename: fileConfig.filename
                });

                files.push(file);
                logger.info(`✅ Scaricato: ${fileConfig.filename} da ${fileConfig.directory}`);
            } catch (error: any) {
                logger.warn(`⚠️ Impossibile scaricare ${fileConfig.filename}: ${error.message}`);
            }
        }

        logger.info(`Scaricati ${files.length}/${filesToDownload.length} file`);

        // Verifica che i file critici siano stati scaricati
        // Nota: descp.txt è ora critico perché contiene la maggior parte dei prodotti
        const downloadedNames = files.map(f => f.filename);
        if (!downloadedNames.includes('prezzi.txt') && !downloadedNames.includes('prezzi_no_sconto.txt')) {
            throw new Error('Nessun file prezzi trovato. Impossibile procedere.');
        }
        if (!downloadedNames.includes('articoli.txt') && !downloadedNames.includes('descp.txt')) {
            throw new Error('Nessun file prodotti (articoli.txt o descp.txt) trovato. Impossibile procedere.');
        }

        // Parsa ogni file
        const parsedFiles: Array<{ filename: string; rows: any[] }> = [];

        for (const file of files) {
            const parseResult = await FileParserService.parseFile({
                format: 'CSV',
                buffer: file.buffer,
                encoding: 'UTF-8',
                csvSeparator: '|',
                quote: '' // Fondamentale: disabilita quoting per pollici (")
            });

            // Normalizza il campo chiave (es. 'codice' -> 'Codice') nei file prezzi
            if (file.filename.startsWith('prezzi')) {
                parseResult.rows = parseResult.rows.map(row => {
                    const k = Object.keys(row).find(key => key.toLowerCase() === 'codice');
                    if (k && k !== 'Codice') {
                        row['Codice'] = row[k];
                        delete row[k];
                    }
                    return row;
                });
            }

            // Normalizza descp.txt
            if (file.filename === 'descp.txt') {
                parseResult.rows = parseResult.rows.map(row => {
                    // Debug specifico
                    if (row['Codice'] === '4711636046138' || row['Codice']?.includes('4711636046138')) {
                        logger.info(`🔍 DEBUG RUNNER: Trovato 4711636046138 in descp.txt. Descrizione: ${row['Descrizione']}`);
                    }

                    // Mappa Descrizione -> DescProd se manca
                    if (row['Descrizione']) {
                        row['DescrizioneEstesa'] = row['Descrizione']; // Salva l'originale
                        // Non sovrascriviamo DescProd qui, lo farà il merge se manca
                    }
                    return row;
                });
            }

            parsedFiles.push({
                filename: file.filename,
                rows: parseResult.rows
            });

            logger.info(`Parsed ${file.filename}: ${parseResult.rows.length} rows`);
        }

        // Merge per campo Codice
        // IMPORTANTE: Runner ha i prodotti sparsi tra articoli.txt e descp.txt.
        // descp.txt sembra contenere più prodotti.
        // Usiamo una logica di merge che prende l'unione di tutti i codici.

        let mergedRows = FileMergeService.mergeFilesByKeySimple(parsedFiles, 'Codice');

        // Post-processing
        mergedRows = mergedRows.map(row => {
            // Se manca DescProd (da articoli.txt), usa Descrizione (da descp.txt)
            if (!row['DescProd'] && row['Descrizione']) {
                row['DescProd'] = row['Descrizione'].replace(/<[^>]*>?/gm, '').substring(0, 255);
            }

            // Fallback per PrezzoPers (da prezzi_no_sconto.txt se prezzi.txt manca)
            // Nota: prezzi_no_sconto.txt usa spesso campi come "Prezzo"
            if (!row['PrezzoPers'] && row['Prezzo']) {
                row['PrezzoPers'] = row['Prezzo'];
            }

            // Se manca EAN (CodiceEAN), prova a vedere se è nel Codice
            if (!row['CodiceEAN'] && row['Codice'] && /^\d{13}$/.test(row['Codice'].toString())) {
                row['CodiceEAN'] = row['Codice'];
            }

            return row;
        });

        logger.info(`✅ Merge completato: ${mergedRows.length} prodotti unici`);
        return mergedRows;
    }
}
