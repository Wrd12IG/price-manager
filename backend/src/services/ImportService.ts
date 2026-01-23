import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { decrypt } from '../utils/encryption';

export class ImportService {
    static async importaListino(fornitoreId: number): Promise<any> {
        logger.info(`=== START IMPORT [ID: ${fornitoreId}] ===`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) throw new AppError('Fornitore non trovato', 404);
        if (!fornitore.urlListino) throw new AppError('URL listino mancante nel fornitore', 400);
        if (fornitore.mappatureCampi.length === 0) throw new AppError('Mappatura campi mancante. Configurala nella sezione Mappature.', 400);

        const mapConfig: Record<string, string> = {};
        fornitore.mappatureCampi.forEach(m => mapConfig[m.campoStandard] = m.campoOriginale);

        const log = await prisma.logElaborazione.create({
            data: { faseProcesso: `IMPORT_${fornitore.nomeFornitore}`, stato: 'running' }
        });

        try {
            // Download flessibile
            const response = await axios.get(fornitore.urlListino, {
                responseType: 'stream',
                timeout: 60000
            });

            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            let processed = 0;
            let success = 0;
            const batch: any[] = [];

            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: response.data,
                csvSeparator: fornitore.separatoreCSV,
                onRow: async (row) => {
                    processed++;
                    const sku = row[mapConfig['sku']]?.toString().trim();
                    const ean = row[mapConfig['ean']]?.toString().trim();
                    const prezzo = parseFloat(row[mapConfig['prezzo']]?.toString().replace(',', '.') || '0');

                    if (sku || ean) {
                        batch.push({
                            fornitoreId,
                            skuFornitore: (sku || ean).toString(),
                            eanGtin: ean,
                            descrizioneOriginale: row[mapConfig['nome']]?.toString(),
                            prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                            quantitaDisponibile: parseInt(row[mapConfig['quantita']] || '0'),
                            altriCampiJson: JSON.stringify(row)
                        });

                        if (batch.length >= 50) {
                            await prisma.listinoRaw.createMany({ data: [...batch] });
                            success += batch.length;
                            batch.length = 0;
                        }
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

            return { total: processed, inserted: success };

        } catch (error: any) {
            logger.error(`CRITICAL FAILURE fornitore ${fornitoreId}:`, error.message);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            }).catch(() => { });

            // Lanciamo l'errore con un messaggio che il frontend DEVE leggere
            throw new AppError(`Errore Importazione: ${error.message}`, 500);
        }
    }
}
