import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';

export class FileMergeService {
    /**
     * Unisce più file parsati in base a un campo chiave comune (es. CODICE)
     * @param parsedFiles Array di risultati di parsing con nome file
     * @param keyField Campo chiave per l'unione (es. 'CODICE', 'EAN')
     * @returns Array di oggetti uniti
     */
    static mergeFilesByKey(
        parsedFiles: Array<{ filename: string; rows: any[] }>,
        keyField: string
    ): any[] {
        logger.info(`Inizio merge di ${parsedFiles.length} file per campo: ${keyField}`);

        // Mappa: keyValue -> oggetto unito
        const mergedData = new Map<string, any>();

        // Itera su ogni file
        for (const file of parsedFiles) {
            logger.info(`Processing file: ${file.filename} (${file.rows.length} rows)`);

            for (const row of file.rows) {
                const keyValue = row[keyField]?.toString().trim();

                if (!keyValue) {
                    // Salta righe senza chiave
                    continue;
                }

                // Se la chiave esiste già, unisci i dati
                if (mergedData.has(keyValue)) {
                    const existing = mergedData.get(keyValue)!;

                    // Unisci tutti i campi del nuovo file
                    // Prefissa i campi con il nome del file per evitare conflitti
                    const filePrefix = file.filename.replace(/\.(txt|csv|xlsx?)$/i, '');

                    for (const [key, value] of Object.entries(row)) {
                        if (key !== keyField) {
                            // Se il campo esiste già senza prefisso, usa il prefisso
                            const prefixedKey = `${filePrefix}_${key}`;
                            existing[prefixedKey] = value;
                        }
                    }
                } else {
                    // Prima occorrenza di questa chiave
                    const newRecord: any = { [keyField]: keyValue };

                    // Aggiungi tutti i campi con prefisso del file
                    const filePrefix = file.filename.replace(/\.(txt|csv|xlsx?)$/i, '');

                    for (const [key, value] of Object.entries(row)) {
                        if (key !== keyField) {
                            const prefixedKey = `${filePrefix}_${key}`;
                            newRecord[prefixedKey] = value;
                        }
                    }

                    mergedData.set(keyValue, newRecord);
                }
            }
        }

        const result = Array.from(mergedData.values());
        logger.info(`Merge completato: ${result.length} record unici`);

        return result;
    }

    /**
     * Versione semplificata: unisce senza prefissi, sovrascrivendo i valori
     * (utile quando i file hanno campi diversi senza conflitti)
     */
    static mergeFilesByKeySimple(
        parsedFiles: Array<{ filename: string; rows: any[] }>,
        keyField: string
    ): any[] {
        logger.info(`Inizio merge semplice di ${parsedFiles.length} file per campo: ${keyField}`);

        const mergedData = new Map<string, any>();

        for (const file of parsedFiles) {
            logger.info(`Processing file: ${file.filename} (${file.rows.length} rows)`);

            for (const row of file.rows) {
                const keyValue = row[keyField]?.toString().trim();

                if (!keyValue) continue;

                if (mergedData.has(keyValue)) {
                    // Unisci senza prefissi (i nuovi valori sovrascrivono i vecchi)
                    const existing = mergedData.get(keyValue)!;
                    Object.assign(existing, row);
                } else {
                    mergedData.set(keyValue, { ...row });
                }
            }
        }

        const result = Array.from(mergedData.values());
        logger.info(`Merge semplice completato: ${result.length} record unici`);

        return result;
    }
}
