import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import axios from 'axios';

export class ImportService {
    private static normalizeEAN(ean: string | null): string | null {
        if (!ean) return null;
        const cleaned = ean.trim();
        return (cleaned.length > 0 && cleaned.length <= 14 && /^\d+$/.test(cleaned)) ? cleaned : null;
    }

    static async importaListino(fornitoreId: number): Promise<void> {
        logger.info(`[IMPORT] Starting background import for supplier ${fornitoreId}`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore || !fornitore.urlListino) {
            logger.error(`[IMPORT] Supplier ${fornitoreId} not found or missing URL`);
            return;
        }

        if (fornitore.mappatureCampi.length === 0) {
            logger.error(`[IMPORT] Supplier ${fornitoreId} has no field mappings`);
            return;
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

        try {
            const response = await axios.get(fornitore.urlListino, {
                responseType: 'stream',
                timeout: 900000
            });

            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            let count = 0;
            let batch: any[] = [];
            const BATCH_SIZE = 100;

            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: response.data,
                csvSeparator: fornitore.separatoreCSV,
                onRow: async (row) => {
                    count++;
                    const sku = row[map['sku']] || row[map['ean']];
                    const ean = this.normalizeEAN(row[map['ean']]?.toString());
                    const prezzo = parseFloat(row[map['prezzo']]?.toString().replace(',', '.') || '0');

                    if (sku || ean) {
                        batch.push({
                            fornitoreId,
                            skuFornitore: (sku || ean).toString().trim(),
                            eanGtin: ean,
                            prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                            quantitaDisponibile: parseInt(row[map['quantita']] || '0'),
                            descrizioneOriginale: row[map['nome']]?.toString() || null,
                            altriCampiJson: JSON.stringify(row)
                        });

                        if (batch.length >= BATCH_SIZE) {
                            await prisma.listinoRaw.createMany({ data: [...batch] });
                            batch = [];

                            if (count % 1000 === 0) {
                                await prisma.logElaborazione.update({
                                    where: { id: log.id },
                                    data: { prodottiProcessati: count }
                                }).catch(() => { });
                            }
                        }
                    }
                }
            });

            if (batch.length > 0) {
                await prisma.listinoRaw.createMany({ data: batch });
            }

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'success', prodottiProcessati: count }
            });

            logger.info(`[IMPORT] Finished import for supplier ${fornitoreId}. Total: ${count}`);

        } catch (error: any) {
            logger.error(`[IMPORT CRASH] Supplier ${fornitoreId}: ${error.message}`);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            }).catch(() => { });
        }
    }

    static async importAllListini(): Promise<{ success: boolean; count: number }> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        for (const f of fornitori) {
            // Background call
            ImportService.importaListino(f.id).catch(err => logger.error(`Error in background all-import: ${err.message}`));
        }
        return { success: true, count: fornitori.length };
    }
}
