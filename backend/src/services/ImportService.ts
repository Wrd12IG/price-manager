import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';

export class ImportService {
    static async importaListino(fornitoreId: number): Promise<any> {
        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore || !fornitore.urlListino) throw new AppError('Configurazione fornitore incompleta', 400);
        if (fornitore.mappatureCampi.length === 0) throw new AppError('Mappatura mancante. Vai nella sezione Mappature.', 400);

        const map = fornitore.mappatureCampi.reduce((acc: any, m) => {
            acc[m.campoStandard] = m.campoOriginale;
            return acc;
        }, {});

        const log = await prisma.logElaborazione.create({
            data: { faseProcesso: `IMPORT_${fornitore.nomeFornitore}`, stato: 'running' }
        });

        try {
            const resp = await axios.get(fornitore.urlListino, { responseType: 'stream', timeout: 900000 });
            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            let count = 0;
            let success = 0;
            let batch: any[] = [];

            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: resp.data,
                csvSeparator: fornitore.separatoreCSV,
                onRow: async (row) => {
                    count++;
                    const sku = row[map['sku']] || row[map['ean']];
                    if (sku) {
                        batch.push({
                            fornitoreId,
                            skuFornitore: sku.toString().trim(),
                            eanGtin: row[map['ean']]?.toString().trim() || null,
                            prezzoAcquisto: parseFloat(row[map['prezzo']]?.toString().replace(',', '.') || '0'),
                            quantitaDisponibile: parseInt(row[map['quantita']] || '0'),
                            descrizioneOriginale: row[map['nome']]?.toString() || null,
                            altriCampiJson: JSON.stringify(row)
                        });
                    }

                    if (batch.length >= 20) { // Batch piccolo per non saturare Supabase
                        await prisma.listinoRaw.createMany({ data: [...batch] });
                        success += batch.length;
                        batch.length = 0;
                    }
                }
            });

            if (batch.length > 0) {
                await prisma.listinoRaw.createMany({ data: batch });
                success += batch.length;
            }

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'success', prodottiProcessati: success }
            });

            return { total: count, inserted: success };
        } catch (e: any) {
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: e.message }) }
            }).catch(() => { });
            throw new AppError(e.message, 500);
        }
    }
}
