import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { decrypt } from '../utils/encryption';

export class ImportService {

    /**
     * Normalizza l'EAN a 13 caratteri
     */
    private static normalizeEAN(ean: string | null): string | null {
        if (!ean) return null;

        const cleaned = ean.trim();
        if (cleaned.length === 0) return null;

        if (!/^\d+$/.test(cleaned)) {
            logger.warn(`EAN non valido (contiene caratteri non numerici): ${cleaned}`);
            return null;
        }

        if (cleaned.length > 14) {
            logger.warn(`EAN troppo lungo (> 14 caratteri), riga scartata: ${cleaned}`);
            return null;
        }

        return cleaned;
    }

    /**
     * Esegue l'importazione completa del listino di un fornitore
     */
    static async importaListino(fornitoreId: number, consolidate: boolean = true): Promise<{ total: number; inserted: number; errors: number }> {
        logger.info(`Inizio importazione listino fornitore ${fornitoreId} (Consolidamento: ${consolidate})`);

        // 1. Recupera fornitore e mappature
        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) {
            throw new AppError('Fornitore non trovato', 404);
        }

        if (!fornitore.urlListino && fornitore.tipoAccesso !== 'ftp') {
            throw new AppError('URL listino mancante', 400);
        }

        if (fornitore.tipoAccesso === 'ftp' && (!fornitore.ftpHost || !fornitore.ftpDirectory)) {
            throw new AppError('Configurazione FTP incompleta (host e directory richiesti)', 400);
        }

        if (fornitore.mappatureCampi.length === 0) {
            throw new AppError('Mappatura campi non configurata. Configurala prima di importare.', 400);
        }

        const mapConfig: Record<string, string> = {};
        fornitore.mappatureCampi.forEach((m: any) => {
            mapConfig[m.campoStandard] = m.campoOriginale;
        });

        logger.info(`Mappatura caricata per fornitore ${fornitoreId}:`, mapConfig);

        // 0. Crea log iniziale per tracciamento progresso
        const log = await prisma.logElaborazione.create({
            data: {
                faseProcesso: `IMPORT_${fornitore.nomeFornitore}`,
                stato: 'running',
                prodottiProcessati: 0,
                dettagliJson: JSON.stringify({ fornitoreId: fornitore.id, nomeFornitore: fornitore.nomeFornitore })
            }
        });

        let allRows: any[] = [];

        try {
            // 2. Scarica i file (HTTP o FTP)
            if (fornitore.tipoAccesso === 'ftp') {
                const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
                logger.info(`Scaricamento file FTP: ${fornitore.nomeFornitore}`);

                if (fornitore.nomeFornitore === 'Runner') {
                    const { RunnerFTPService } = await import('./RunnerFTPService');
                    allRows = await RunnerFTPService.downloadAndMergeRunnerFiles({
                        host: fornitore.ftpHost!,
                        port: fornitore.ftpPort || 21,
                        user: fornitore.username || 'anonymous',
                        password
                    });
                } else {
                    const { FTPService } = await import('./FTPService');
                    const { FileMergeService } = await import('./FileMergeService');

                    const files = await FTPService.downloadAndMergeFiles({
                        host: fornitore.ftpHost!,
                        port: fornitore.ftpPort || 21,
                        user: fornitore.username || 'anonymous',
                        password,
                        directory: fornitore.ftpDirectory!
                    });

                    const parsedFiles: Array<{ filename: string; rows: any[] }> = [];
                    for (const file of files) {
                        const parseResult = await FileParserService.parseFile({
                            format: fornitore.formatoFile,
                            buffer: file.buffer,
                            encoding: fornitore.encoding,
                            csvSeparator: fornitore.separatoreCSV
                        });
                        parsedFiles.push({ filename: file.filename, rows: parseResult.rows });
                    }
                    allRows = FileMergeService.mergeFilesByKeySimple(parsedFiles, 'Codice');
                }
                logger.info(`File FTP processati: ${allRows.length} record unici`);
            } else {
                const axiosConfig: any = {
                    responseType: 'arraybuffer',
                    timeout: 600000,
                    validateStatus: (status: number) => status < 500
                };

                if (!fornitore.urlListino) throw new AppError('URL listino mancante', 400);
                if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                    const password = decrypt(fornitore.passwordEncrypted);
                    axiosConfig.auth = { username: fornitore.username, password };
                }

                logger.info(`Scaricamento file da ${fornitore.urlListino}...`);
                const response = await axios.get(fornitore.urlListino as string, axiosConfig);
                const buffer = Buffer.from(response.data);

                logger.info('Parsing file...');
                const isBrevi = fornitore.nomeFornitore.toLowerCase().includes('brevi') || fornitore.id === 1;
                const quoteChar = isBrevi ? '' : '"';

                const parseResult = await FileParserService.parseFile({
                    format: fornitore.formatoFile,
                    buffer: buffer,
                    encoding: fornitore.encoding,
                    csvSeparator: fornitore.separatoreCSV,
                    quote: quoteChar
                });
                allRows = parseResult.rows;
            }

            const totalRows = allRows.length;
            logger.info(`File parsato. ${totalRows} righe trovate.`);

            // Aggiorna log con totale righe
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { dettagliJson: JSON.stringify({ fornitoreId: fornitore.id, nomeFornitore: fornitore.nomeFornitore, totalRows }) }
            });

            // 4. Normalizza e Salva
            const batchSize = 500;
            let processed = 0;
            let inserted = 0;
            let errors = 0;
            const dataToInsert: any[] = [];

            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            for (const row of allRows) {
                try {
                    const skuKey = mapConfig['sku'];
                    const nomeKey = mapConfig['nome'];
                    const prezzoKey = mapConfig['prezzo'];
                    const quantitaKey = mapConfig['quantita'];
                    const eanKey = mapConfig['ean'];
                    const descrizioneKey = mapConfig['descrizione'];
                    const categoriaKey = mapConfig['categoria'];
                    const marcaKey = mapConfig['marca'];

                    const sku = skuKey ? row[skuKey]?.toString().trim() : null;
                    const nome = nomeKey ? row[nomeKey]?.toString().trim() : null;
                    const rawPrezzo = prezzoKey ? row[prezzoKey] : null;
                    const prezzoStr = rawPrezzo ? rawPrezzo.toString().replace(',', '.') : '0';
                    const quantitaStr = quantitaKey ? row[quantitaKey]?.toString() : '0';
                    const eanRaw = eanKey ? row[eanKey]?.toString().trim() : null;

                    let ean = this.normalizeEAN(eanRaw);

                    if (!ean && eanRaw && !/^\d+$/.test(eanRaw)) {
                        for (const [key, val] of Object.entries(row)) {
                            if (key === skuKey) continue;
                            const valStr = val?.toString().replace(/\s+/g, '').trim();
                            if (valStr && /^\d{8,14}$/.test(valStr)) {
                                if (valStr.length === 12) ean = '0' + valStr;
                                else if (valStr.length === 13) ean = valStr;
                                else if (valStr.length === 8) ean = valStr;
                                else if (valStr.length === 14) ean = valStr;
                                if (ean) break;
                            }
                        }
                    }

                    let finalSku: string;
                    if (ean) finalSku = ean;
                    else if (sku) finalSku = sku;
                    else if (row['Codice']) finalSku = row['Codice'].toString().trim();
                    else {
                        errors++;
                        continue;
                    }

                    const prezzo = parseFloat(prezzoStr);
                    const finalPrezzo = isNaN(prezzo) ? 0 : prezzo;
                    const quantita = parseInt(quantitaStr || '0');
                    const marca = marcaKey ? row[marcaKey]?.toString().trim() || null : null;
                    const categoria = categoriaKey ? row[categoriaKey]?.toString().trim() || null : null;

                    dataToInsert.push({
                        fornitoreId,
                        skuFornitore: finalSku,
                        eanGtin: ean,
                        descrizioneOriginale: nome || (descrizioneKey ? row[descrizioneKey]?.toString() : null),
                        prezzoAcquisto: finalPrezzo,
                        quantitaDisponibile: isNaN(quantita) ? 0 : quantita,
                        categoriaFornitore: categoria,
                        marca: marca,
                        altriCampiJson: JSON.stringify(row)
                    });

                    processed++;

                    if (processed % 1000 === 0) {
                        const percent = Math.round((processed / totalRows) * 100);
                        logger.info(`[IMPORT ${fornitore.nomeFornitore}] Progresso: ${processed}/${totalRows} (${percent}%)`);

                        // Aggiorna progress nel database per il frontend
                        await prisma.logElaborazione.update({
                            where: { id: log.id },
                            data: { prodottiProcessati: processed }
                        });
                    }

                    if (dataToInsert.length >= batchSize) {
                        await prisma.listinoRaw.createMany({ data: dataToInsert });
                        inserted += dataToInsert.length;
                        dataToInsert.length = 0;
                    }

                } catch (err) {
                    errors++;
                    logger.error(`Error processing row:`, err);
                }
            }

            if (dataToInsert.length > 0) {
                await prisma.listinoRaw.createMany({ data: dataToInsert });
                inserted += dataToInsert.length;
            }

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            // Aggiorna log finale
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: {
                    stato: 'success',
                    prodottiProcessati: processed,
                    prodottiErrore: errors,
                    durataSecondi: Math.round((Date.now() - log.createdAt.getTime()) / 1000)
                }
            });

            logger.info(`Importazione completata. Totale: ${processed}, Inseriti: ${inserted}, Errori/Saltati: ${errors}`);

            if (consolidate) {
                try {
                    const { MasterFileService } = await import('./MasterFileService');
                    await MasterFileService.consolidaMasterFile();

                    const { MarkupService } = await import('./MarkupService');
                    await MarkupService.applicaRegolePrezzi();
                } catch (err) {
                    logger.error('Errore post-importazione (consolidamento/pricing):', err);
                }
            }

            return { total: processed, inserted, errors };

        } catch (error: any) {
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            });
            throw error;
        }
    }

    /**
     * Esegue l'importazione di TUTTI i fornitori attivi
     */
    static async importAllListini(): Promise<{ results: any[]; totalErrors: number }> {
        logger.info('🚀 Avvio importazione massiva di tutti i listini...');

        const fornitori = await prisma.fornitore.findMany({
            where: { attivo: true }
        });

        const results = [];
        let totalErrors = 0;

        for (const fornitore of fornitori) {
            try {
                logger.info(`Processing ${fornitore.nomeFornitore}...`);
                const result = await this.importaListino(fornitore.id, false);
                results.push({ fornitore: fornitore.nomeFornitore, success: true, stats: result });
            } catch (err: any) {
                logger.error(`Errore import fornitore ${fornitore.nomeFornitore}:`, err);
                results.push({ fornitore: fornitore.nomeFornitore, success: false, error: err.message });
                totalErrors++;
            }
        }

        try {
            const { MasterFileService } = await import('./MasterFileService');
            await MasterFileService.consolidaMasterFile();
            const { MarkupService } = await import('./MarkupService');
            await MarkupService.applicaRegolePrezzi();
        } catch (err) {
            logger.error('Errore durante consolidamento finale:', err);
        }

        return { results, totalErrors };
    }
}
