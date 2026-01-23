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

    static async importaListino(fornitoreId: number): Promise<{ total: number; success: boolean; error?: string }> {
        logger.info(`[IMPORT] Starting import for supplier ${fornitoreId}`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore || !fornitore.urlListino) {
            return { total: 0, success: false, error: 'Supplier not found or missing URL' };
        }

        if (fornitore.mappatureCampi.length === 0) {
            return { total: 0, success: false, error: 'No field mappings configured' };
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

            return { total: count, success: true };

        } catch (error: any) {
            logger.error(`[IMPORT CRASH] Supplier ${fornitoreId}: ${error.message}`);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            }).catch(() => { });
            return { total: 0, success: false, error: error.message };
        }
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
