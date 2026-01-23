import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import { decrypt } from '../utils/encryption';

export class ImportService {
    static async importaListino(fornitoreId: number): Promise<any> {
        logger.info(`🚀 AVVIO IMPORTAZIONE ULTRA-STABILE [Fornitore: ${fornitoreId}]`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) throw new AppError('Fornitore non trovato', 404);
        if (fornitore.mappatureCampi.length === 0) throw new AppError('Mappatura mancante. Configurala in "Mappature".', 400);

        const map = fornitore.mappatureCampi.reduce((acc: any, m) => {
            acc[m.campoStandard] = m.campoOriginale;
            return acc;
        }, {});

        const log = await prisma.logElaborazione.create({
            data: { faseProcesso: `IMPORT_${fornitore.nomeFornitore}`, stato: 'running', prodottiProcessati: 0 }
        });

        try {
            // USIAMO 'stream' PER NON CARICARE IL FILE IN RAM
            const axiosConfig: any = { responseType: 'stream', timeout: 900000 };
            if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                const password = decrypt(fornitore.passwordEncrypted);
                axiosConfig.auth = { username: fornitore.username, password };
            }

            logger.info(`Download in corso: ${fornitore.urlListino}`);
            const response = await axios.get(fornitore.urlListino!, axiosConfig);

            // PuliAMO listino precedente
            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            let processed = 0;
            let success = 0;
            const batch: any[] = [];

            // Analizziamo in streaming
            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: response.data,
                csvSeparator: fornitore.separatoreCSV,
                onRow: async (row) => {
                    processed++;
                    const sku = row[map['sku']] || row[map['ean']];
                    const prezzo = parseFloat(row[map['prezzo']]?.toString().replace(',', '.') || '0');

                    if (sku) {
                        batch.push({
                            fornitoreId,
                            skuFornitore: sku.toString().trim(),
                            eanGtin: row[map['ean']]?.toString().trim() || null,
                            prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                            quantitaDisponibile: parseInt(row[map['quantita']] || '0'),
                            descrizioneOriginale: row[map['nome']]?.toString() || null,
                            altriCampiJson: JSON.stringify(row)
                        });

                        if (batch.length >= 100) {
                            await prisma.listinoRaw.createMany({ data: [...batch] });
                            success += batch.length;
                            batch.length = 0;

                            // Ogni 1000 righe aggiorniamo il log nel database (per il frontend)
                            if (processed % 1000 === 0) {
                                await prisma.logElaborazione.update({
                                    where: { id: log.id },
                                    data: { prodottiProcessati: success }
                                }).catch(() => { });
                            }
                        }
                    }
                }
            });

            // Salviamo l'ultimo pezzo
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
            logger.error(`CRASH FINALE: ${error.message}`);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: error.message }) }
            }).catch(() => { });
            throw new AppError(`Errore Fatale: ${error.message}`, 500);
        }
    }

    static async importAllListini(): Promise<any> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        for (const f of fornitori) {
            await this.importaListino(f.id).catch(e => logger.error(`Error in mass import for ${f.nomeFornitore}: ${e.message}`));
        }
        return { success: true };
    }
}
