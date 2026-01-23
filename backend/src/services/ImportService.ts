import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { decrypt } from '../utils/encryption';

export class ImportService {

    private static normalizeEAN(ean: string | null): string | null {
        if (!ean) return null;
        const cleaned = ean.trim();
        if (cleaned.length === 0) return null;
        if (!/^\d+$/.test(cleaned)) return null;
        if (cleaned.length > 14) return null;
        return cleaned;
    }

    static async importaListino(fornitoreId: number, consolidate: boolean = false): Promise<{ total: number; inserted: number; errors: number }> {
        logger.info(`🚀 Avvio Importazione DOUBLE STREAMING fornitore ${fornitoreId}`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) throw new AppError('Fornitore non trovato', 404);
        if (fornitore.mappatureCampi.length === 0) throw new AppError('Mappatura campi mancante. Vai nella sezione Mappature.', 400);

        const mapConfig: Record<string, string> = {};
        fornitore.mappatureCampi.forEach((m: any) => {
            mapConfig[m.campoStandard] = m.campoOriginale;
        });

        const log = await prisma.logElaborazione.create({
            data: {
                faseProcesso: `IMPORT_${fornitore.nomeFornitore}`,
                stato: 'running',
                prodottiProcessati: 0,
                dettagliJson: JSON.stringify({ fornitoreId: fornitore.id, nomeFornitore: fornitore.nomeFornitore })
            }
        });

        try {
            // SCARICAMENTO IN STREAMING (Zera l'uso della RAM per il file)
            const axiosConfig: any = { responseType: 'stream', timeout: 900000 };
            if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                const password = decrypt(fornitore.passwordEncrypted);
                axiosConfig.auth = { username: fornitore.username, password };
            }

            logger.info(`Connessione all'URL: ${fornitore.urlListino}`);
            const response = await axios.get(fornitore.urlListino as string, axiosConfig);
            const sourceStream = response.data;

            // Pulizia database
            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            const batchSize = 100;
            const dataToInsert: any[] = [];
            let processed = 0;
            let inserted = 0;
            let errors = 0;

            const quoteChar = fornitore.nomeFornitore.toLowerCase().includes('brevi') ? '' : '"';

            // PARSING IN STREAMING
            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: sourceStream,
                encoding: fornitore.encoding,
                csvSeparator: fornitore.separatoreCSV,
                quote: quoteChar,
                onRow: async (row: any) => {
                    try {
                        const sku = mapConfig['sku'] ? row[mapConfig['sku']]?.toString().trim() : null;
                        const nome = mapConfig['nome'] ? row[mapConfig['nome']]?.toString().trim() : null;
                        const prezzoRaw = mapConfig['prezzo'] ? row[mapConfig['prezzo']] : null;
                        const prezzo = parseFloat(prezzoRaw?.toString().replace(',', '.') || '0');
                        const ean = this.normalizeEAN(mapConfig['ean'] ? row[mapConfig['ean']]?.toString().trim() : null);

                        if (!sku && !ean) {
                            errors++;
                            return;
                        }

                        dataToInsert.push({
                            fornitoreId,
                            skuFornitore: (ean || sku || 'N/A').toString(),
                            eanGtin: ean,
                            descrizioneOriginale: nome,
                            prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                            quantitaDisponibile: parseInt(row[mapConfig['quantita']] || '0'),
                            categoriaFornitore: row[mapConfig['categoria']]?.toString() || null,
                            marca: row[mapConfig['marca']]?.toString() || null,
                            altriCampiJson: JSON.stringify(row)
                        });

                        processed++;

                        if (dataToInsert.length >= batchSize) {
                            await prisma.listinoRaw.createMany({ data: [...dataToInsert] });
                            inserted += dataToInsert.length;
                            dataToInsert.length = 0;

                            if (processed % 1000 === 0) {
                                logger.info(`Import progress: ${processed} righe salvate...`);
                                await prisma.logElaborazione.update({
                                    where: { id: log.id },
                                    data: { prodottiProcessati: processed }
                                }).catch(() => { });
                            }
                        }
                    } catch (e) {
                        errors++;
                    }
                }
            });

            // Flush finale
            if (dataToInsert.length > 0) {
                await prisma.listinoRaw.createMany({ data: dataToInsert });
                inserted += dataToInsert.length;
            }

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: {
                    stato: 'success',
                    prodottiProcessati: processed,
                    prodottiErrore: errors,
                    durataSecondi: Math.round((Date.now() - log.createdAt.getTime()) / 1000)
                }
            });

            return { total: processed, inserted, errors };

        } catch (error: any) {
            console.error('CRITICAL IMPORT ERROR:', error);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            }).catch(() => { });
            throw new AppError(`Fallimento importazione: ${error.message}`, 500);
        }
    }

    static async importAllListini(): Promise<{ results: any[]; totalErrors: number }> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        const results = [];
        let totalErrors = 0;
        for (const fornitore of fornitori) {
            try {
                const result = await this.importaListino(fornitore.id, false);
                results.push({ fornitore: fornitore.nomeFornitore, success: true, stats: result });
            } catch (err: any) {
                results.push({ fornitore: fornitore.nomeFornitore, success: false, error: err.message });
                totalErrors++;
            }
        }
        return { results, totalErrors };
    }
}
