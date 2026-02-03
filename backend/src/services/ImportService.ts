// @ts-nocheck
import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import axios from 'axios';
import { decrypt } from '../utils/encryption';
import { FTPService } from './FTPService';
import { PassThrough } from 'stream';
import { RunnerFTPService } from './RunnerFTPService';
import { jobProgressManager } from './JobProgressService';

export class ImportService {
    private static normalizeEAN(ean: string | null): string | null {
        if (!ean) return null;
        const cleaned = ean.trim();
        return (cleaned.length > 0 && cleaned.length <= 14 && /^\d+$/.test(cleaned)) ? cleaned : null;
    }

    static async importaListino(utenteId: number, fornitoreId: number): Promise<{ total: number; success: boolean; error?: string }> {
        logger.info(`[IMPORT] Inizio elaborazione utente ${utenteId} - fornitore ${fornitoreId}`);

        const fornitore = await (prisma.fornitore as any).findFirst({
            where: { id: fornitoreId, utenteId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) {
            return { total: 0, success: false, error: 'Fornitore non trovato o non autorizzato' };
        }

        // --- CASO SPECIALE RUNNER ---
        if (fornitore.nomeFornitore.toLowerCase() === 'runner') {
            return this.importaRunner(utenteId, fornitore);
        }

        const isFTP = fornitore.tipoAccesso === 'ftp';
        if (!fornitore.urlListino && !isFTP) {
            return { total: 0, success: false, error: 'Configurazione incompleta (manca URL o FTP)' };
        }

        if ((fornitore as any).mappatureCampi.length === 0) {
            return { total: 0, success: false, error: 'Nessuna mappatura campi configurata' };
        }

        const map = (fornitore as any).mappatureCampi.reduce((acc: any, m: any) => {
            acc[m.campoStandard] = m.campoOriginale;
            return acc;
        }, {});

        const jobId = jobProgressManager.createJob('import', { utenteId, fornitoreId, fornitoreNome: fornitore.nomeFornitore });
        jobProgressManager.startJob(jobId, `Download listino ${fornitore.nomeFornitore}...`);

        const log = await prisma.logElaborazione.create({
            data: {
                utenteId: utenteId,
                faseProcesso: `IMPORT_${fornitore.nomeFornitore}`,
                stato: 'running',
                prodottiProcessati: 0
            }
        });

        let totalCount = 0;

        try {
            // --- DELTA-SYNC: Prendiamo il timestamp di inizio ---
            const importTime = new Date();

            if (isFTP) {
                const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
                const baseDir = fornitore.ftpDirectory || '/';
                const directories = baseDir.split(/[;,]/).map(d => d.trim()).filter(d => d.length > 0);

                if (directories.length === 0) directories.push('/');

                for (const dir of directories) {
                    logger.info(`[FTP] Esploro directory: ${dir}`);
                    const files = await FTPService.listFiles({
                        host: fornitore.ftpHost!,
                        port: fornitore.port || 21,
                        user: fornitore.username || 'anonymous',
                        password,
                        directory: dir
                    });

                    const validFiles = files.filter(f => f.isFile && (
                        f.name.endsWith('.csv') ||
                        f.name.endsWith('.txt') ||
                        f.name.endsWith('.zip') ||
                        /^[A-Z]\d{6}/.test(f.name)
                    ));

                    for (const file of validFiles) {
                        try {
                            const stream = new PassThrough();
                            const downloadPromise = FTPService.downloadToStream({
                                host: fornitore.ftpHost!,
                                port: fornitore.port || 21,
                                user: fornitore.username || 'anonymous',
                                password,
                                directory: dir,
                                filename: file.name
                            }, stream);

                            let lastFileValidCount = 0;
                            await this.processStream(utenteId, stream, fornitore, map, (count) => {
                                const currentTotal = totalCount + count - lastFileValidCount;
                                prisma.logElaborazione.update({
                                    where: { id: log.id },
                                    data: { prodottiProcessati: currentTotal }
                                }).catch(() => { });

                                jobProgressManager.updateProgress(jobId, 50, `Importati ${currentTotal} prodotti da ${fornitore.nomeFornitore}`);
                            }).then(validCount => {
                                totalCount += validCount;
                                lastFileValidCount = validCount;
                            });

                            await downloadPromise;
                        } catch (fileErr: any) {
                            logger.warn(`[FTP] ⚠️ Errore file ${file.name}: ${fileErr.message}`);
                        }
                    }
                }
            } else {
                // --- LOGICA HTTP ---
                logger.info(`[HTTP] Download listino da: ${fornitore.urlListino}`);
                const response = await axios.get(fornitore.urlListino!, {
                    responseType: 'stream',
                    timeout: 600000, // 10 minuti di timeout
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    maxRedirects: 10,
                    validateStatus: (status) => status < 500
                });

                if (response.status !== 200) {
                    throw new Error(`Il server ha risposto con codice ${response.status}`);
                }

                totalCount = await this.processStream(utenteId, response.data, fornitore, map, (count) => {
                    prisma.logElaborazione.update({
                        where: { id: log.id },
                        data: { prodottiProcessati: count }
                    }).catch(() => { });

                    jobProgressManager.updateProgress(jobId, 50, `Sincronizzazione ${count} prodotti...`);
                });
            }

            // --- FINE IMPORTAZIONE: Pulizia vecchi record (Delta-Sync) ---
            if (totalCount > 0) {
                const deleted = await prisma.listinoRaw.deleteMany({
                    where: {
                        utenteId: utenteId,
                        fornitoreId: fornitoreId,
                        createdAt: { lt: importTime }
                    }
                });
                logger.info(`[DELTA-SYNC] Rimossi ${deleted.count} prodotti obsoleti (Utente ${utenteId}, ${fornitore.nomeFornitore})`);
            }

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'success', prodottiProcessati: totalCount }
            });

            jobProgressManager.completeJob(jobId, `Completato: ${totalCount} prodotti importati`);

            return { total: totalCount, success: true };

        } catch (error: any) {
            logger.error(`[IMPORT CRASH] Utente ${utenteId}, Fornitore ${fornitoreId}: ${error.message}`);

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: {
                    stato: 'error',
                    dettagliJson: JSON.stringify({ error: error.message })
                }
            }).catch(() => { });

            jobProgressManager.failJob(jobId, error.message);
            return { total: totalCount, success: false, error: error.message };
        }
    }

    private static async processStream(utenteId: number, stream: any, fornitore: any, map: any, onBatchProgress: (count: number) => void): Promise<number> {
        let validCount = 0;
        let batch: any[] = [];
        const BATCH_SIZE = 500;

        // FIX BREVI: Disabilita quoting se è Brevi perché usa i pollici (") nel testo senza escaping
        const isBrevi = fornitore.nomeFornitore?.toLowerCase().includes('brevi') || fornitore.urlListino?.includes('brevi');
        const quoteChar = isBrevi ? '\0' : undefined; // undefined usa il default del service (o quello passato)

        await FileParserService.parseFile({
            format: fornitore.formatoFile,
            stream: stream,
            csvSeparator: fornitore.separatoreCSV,
            quote: quoteChar, // Passiamo il quote esplicito
            encoding: isBrevi ? 'latin1' : fornitore.encoding, // Brevi spesso è latin1
            onRow: async (row) => {
                const skuRaw = row[map['sku']] || row[map['ean']] || row['codice'] || row['Codice'] || row['SKU'] || row['sku'];
                const sku = skuRaw ? skuRaw.toString().trim() : null;
                const ean = this.normalizeEAN(row[map['ean']]?.toString());
                const partNumber = row[map['part_number']]?.toString().trim() || null;
                const marca = row[map['marca']]?.toString() || null;

                if (!ean && (!marca || !partNumber)) return;

                const categoria = row[map['categoria']]?.toString().toLowerCase() || '';
                if (categoria.includes('usato') || categoria.includes('fine serie')) return;

                const prezzoRaw = (row[map['prezzo']] || '0').toString().replace(',', '.');
                const prezzo = parseFloat(prezzoRaw);

                const quantitaRaw = (row[map['quantita']] || '0').toString();
                const quantita = parseInt(quantitaRaw);

                if (sku || ean) {
                    batch.push({
                        utenteId: utenteId,
                        fornitoreId: fornitore.id,
                        skuFornitore: (sku || ean || 'N/A').toString(),
                        eanGtin: ean,
                        partNumber: partNumber,
                        prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                        quantitaDisponibile: isNaN(quantita) ? 0 : quantita,
                        descrizioneOriginale: row[map['nome']]?.toString() || null,
                        marca: row[map['marca']]?.toString() || null,
                        categoriaFornitore: row[map['categoria']]?.toString() || null,
                        altriCampiJson: JSON.stringify(row)
                    });

                    validCount++;

                    if (batch.length >= BATCH_SIZE) {
                        await prisma.listinoRaw.createMany({ data: [...batch] });
                        batch = [];
                        if (validCount % 1000 === 0) onBatchProgress(validCount);
                    }
                }
            }
        });

        if (batch.length > 0) {
            await prisma.listinoRaw.createMany({ data: batch });
        }
        onBatchProgress(validCount);
        return validCount;
    }

    private static async importaRunner(utenteId: number, fornitore: any): Promise<{ total: number; success: boolean; error?: string }> {
        const log = await prisma.logElaborazione.create({
            data: {
                utenteId: utenteId,
                faseProcesso: `IMPORT_Runner`,
                stato: 'running',
                prodottiProcessati: 0
            }
        });

        try {
            const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
            const importTime = new Date();
            const ftpConfig = {
                host: (fornitore as any).ftpHost!,
                port: (fornitore as any).port || 21,
                user: (fornitore as any).username!,
                password: password
            };
            const mergedProducts = await RunnerFTPService.downloadAndMergeRunnerFiles(ftpConfig);

            const map = fornitore.mappatureCampi.reduce((acc: any, m: any) => {
                acc[m.campoStandard] = m.campoOriginale;
                return acc;
            }, {});

            let count = 0;
            const BATCH_SIZE = 500;
            for (let i = 0; i < mergedProducts.length; i += BATCH_SIZE) {
                const chunk = mergedProducts.slice(i, i + BATCH_SIZE);
                const batchData = chunk.map(row => {
                    const skuRaw = row[map['sku']] || row['Codice'];
                    const ean = this.normalizeEAN(row[map['ean']]?.toString());
                    const partNumber = row[map['part_number']] || row['CodiceProduttore'] || null;
                    const marca = row[map['marca']] || row['Produttore'] || null;

                    if (!ean && (!marca || !partNumber)) return null;

                    const prezzoRaw = (row[map['prezzo']] || row['PrezzoPers'] || '0').toString().replace(',', '.');
                    const prezzo = parseFloat(prezzoRaw);
                    const quantitaRaw = (row[map['quantita']] || row['Dispo'] || '0').toString();
                    const quantita = parseInt(quantitaRaw);

                    return {
                        utenteId: utenteId,
                        fornitoreId: fornitore.id,
                        skuFornitore: skuRaw?.toString() || 'N/A',
                        eanGtin: ean,
                        partNumber: partNumber?.toString() || null,
                        prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                        quantitaDisponibile: isNaN(quantita) ? 0 : quantita,
                        descrizioneOriginale: row[map['nome']] || row['DescProd'] || null,
                        marca: row[map['marca']] || row['Produttore'] || null,
                        categoriaFornitore: row[map['categoria']] || row['DescCatMerc'] || null,
                        altriCampiJson: JSON.stringify(row)
                    };
                }).filter(x => x !== null) as any[];

                if (batchData.length > 0) {
                    await prisma.listinoRaw.createMany({ data: batchData });
                    count += batchData.length;
                }

                await prisma.logElaborazione.update({
                    where: { id: log.id },
                    data: { prodottiProcessati: count }
                }).catch(() => { });
            }

            if (count > 0) {
                await prisma.listinoRaw.deleteMany({
                    where: {
                        utenteId: utenteId,
                        fornitoreId: fornitore.id,
                        createdAt: { lt: importTime }
                    }
                });
            }

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'success' }
            });

            await prisma.fornitore.update({
                where: { id: fornitore.id },
                data: { ultimaSincronizzazione: new Date() }
            });

            return { total: count, success: true };
        } catch (error: any) {
            logger.error(`Errore Runner utente ${utenteId}: ${error.message}`);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            });
            return { total: 0, success: false, error: error.message };
        }
    }

    static async importAllListini(utenteId: number): Promise<{ results: any[]; totalErrors: number }> {
        const fornitori = await prisma.fornitore.findMany({
            where: { utenteId, attivo: true }
        });
        const results: any[] = [];
        let totalErrors = 0;

        const CONCURRENCY_LIMIT = 2;
        const activeTasks: Promise<void>[] = [];

        for (const f of fornitori) {
            const task = (async () => {
                const result = await this.importaListino(utenteId, f.id);
                results.push({ fornitore: f.nomeFornitore, ...result });
                if (!result.success) totalErrors++;
            })();

            activeTasks.push(task);

            if (activeTasks.length >= CONCURRENCY_LIMIT) {
                await Promise.race(activeTasks);
                // Pulizia task finiti (semplificata)
            }
        }

        await Promise.all(activeTasks);
        return { results, totalErrors };
    }
}
