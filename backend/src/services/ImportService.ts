import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import axios from 'axios';
import { decrypt } from '../utils/encryption';
import { FTPService } from './FTPService';
import { PassThrough } from 'stream';

export class ImportService {
    private static normalizeEAN(ean: string | null): string | null {
        if (!ean) return null;
        const cleaned = ean.trim();
        return (cleaned.length > 0 && cleaned.length <= 14 && /^\d+$/.test(cleaned)) ? cleaned : null;
    }

    static async importaListino(fornitoreId: number): Promise<{ total: number; success: boolean; error?: string }> {
        logger.info(`[IMPORT] Inizio elaborazione fornitore ${fornitoreId}`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) {
            return { total: 0, success: false, error: 'Fornitore non trovato' };
        }

        const isFTP = fornitore.tipoAccesso === 'ftp';
        if (!fornitore.urlListino && !isFTP) {
            return { total: 0, success: false, error: 'Configurazione incompleta (manca URL o FTP)' };
        }

        if (fornitore.mappatureCampi.length === 0) {
            return { total: 0, success: false, error: 'Nessuna mappatura campi configurata' };
        }

        const map = fornitore.mappatureCampi.reduce((acc: any, m) => {
            acc[m.campoStandard] = m.campoOriginale;
            return acc;
        }, {});

        const log = await prisma.logElaborazione.create({
            data: {
                faseProcesso: `IMPORT_${fornitore.nomeFornitore}`,
                stato: 'running',
                prodottiProcessati: 0
            }
        });

        let totalCount = 0;

        try {
            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            if (isFTP) {
                // --- LOGICA FTP ---
                const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
                const files = await FTPService.listFiles({
                    host: fornitore.ftpHost!,
                    port: fornitore.ftpPort || 21,
                    user: fornitore.username || 'anonymous',
                    password,
                    directory: fornitore.ftpDirectory || '/'
                });

                const validFiles = files.filter(f => f.isFile && (f.name.endsWith('.csv') || f.name.endsWith('.txt') || f.name.endsWith('.zip')));
                logger.info(`[FTP] Trovati ${validFiles.length} file validi per ${fornitore.nomeFornitore}`);

                for (const file of validFiles) {
                    const stream = new PassThrough();

                    // Avvolgiamo il download in una promise per gestire il flusso
                    const downloadPromise = FTPService.downloadToStream({
                        host: fornitore.ftpHost!,
                        port: fornitore.ftpPort || 21,
                        user: fornitore.username || 'anonymous',
                        password,
                        directory: fornitore.ftpDirectory || '/',
                        filename: file.name
                    }, stream);

                    await this.processStream(stream, fornitore, map, (count) => {
                        totalCount += count;
                        prisma.logElaborazione.update({
                            where: { id: log.id },
                            data: { prodottiProcessati: totalCount }
                        }).catch(() => { });
                    });

                    await downloadPromise;
                }
            } else {
                // --- LOGICA HTTP ---
                const response = await axios.get(fornitore.urlListino!, {
                    responseType: 'stream',
                    timeout: 900000
                });

                await this.processStream(response.data, fornitore, map, (count) => {
                    totalCount = count;
                    prisma.logElaborazione.update({
                        where: { id: log.id },
                        data: { prodottiProcessati: totalCount }
                    }).catch(() => { });
                });
            }

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'success', prodottiProcessati: totalCount }
            });

            return { total: totalCount, success: true };

        } catch (error: any) {
            const errorInfo = {
                message: error.message || 'Errore sconosciuto',
                code: error.code,
                status: error.response?.status,
                url: error.config?.url
            };

            logger.error(`[IMPORT CRASH] Fornitore ${fornitoreId}: ${errorInfo.message}`, errorInfo);

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: {
                    stato: 'error',
                    dettagliJson: JSON.stringify({
                        error: errorInfo.message,
                        dettagli: errorInfo
                    })
                }
            }).catch(() => { });

            return { total: totalCount, success: false, error: errorInfo.message };
        }
    }

    private static async processStream(stream: any, fornitore: any, map: any, onBatchProgress: (count: number) => void): Promise<void> {
        let count = 0;
        let batch: any[] = [];
        const BATCH_SIZE = 150;

        await FileParserService.parseFile({
            format: fornitore.formatoFile,
            stream: stream,
            csvSeparator: fornitore.separatoreCSV,
            onRow: async (row) => {
                count++;

                const skuRaw = row[map['sku']] || row[map['ean']];
                const sku = skuRaw ? skuRaw.toString().trim() : null;
                const ean = this.normalizeEAN(row[map['ean']]?.toString());

                const prezzoRaw = (row[map['prezzo']] || '0').toString().replace(',', '.');
                const prezzo = parseFloat(prezzoRaw);

                const quantitaRaw = (row[map['quantita']] || '0').toString();
                const quantita = parseInt(quantitaRaw);

                if (sku || ean) {
                    batch.push({
                        fornitoreId: fornitore.id,
                        skuFornitore: (sku || ean || 'N/A').toString(),
                        eanGtin: ean,
                        prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                        quantitaDisponibile: isNaN(quantita) ? 0 : quantita,
                        descrizioneOriginale: row[map['nome']]?.toString() || null,
                        altriCampiJson: JSON.stringify(row)
                    });

                    if (batch.length >= BATCH_SIZE) {
                        await prisma.listinoRaw.createMany({ data: [...batch] });
                        batch = [];
                        if (count % 1000 === 0) onBatchProgress(count);
                    }
                }
            }
        });

        if (batch.length > 0) {
            await prisma.listinoRaw.createMany({ data: batch });
        }
        onBatchProgress(count);
    }

    static async importAllListini(): Promise<{ results: any[]; totalErrors: number }> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        const results = [];
        let totalErrors = 0;

        for (const f of fornitori) {
            const result = await this.importaListino(f.id);
            results.push({ fornitore: f.nomeFornitore, ...result });
            if (!result.success) totalErrors++;
        }

        return { results, totalErrors };
    }
}
