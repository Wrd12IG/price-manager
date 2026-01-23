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
        return (cleaned.length > 0 && cleaned.length <= 14 && /^\d+$/.test(cleaned)) ? cleaned : null;
    }

    static async importaListino(fornitoreId: number): Promise<any> {
        logger.info(`=== AVVIO IMPORTAZIONE SICURA [ID: ${fornitoreId}] ===`);

        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore) throw new AppError('Fornitore non trovato', 404);
        if (fornitore.mappatureCampi.length === 0) throw new AppError('Mappatura campi mancante. Configurala in "Mappature".', 400);

        const map = fornitore.mappatureCampi.reduce((acc: any, m) => {
            acc[m.campoStandard] = m.campoOriginale;
            return acc;
        }, {});

        const log = await prisma.logElaborazione.create({
            data: { faseProcesso: `IMPORT_${fornitore.nomeFornitore}`, stato: 'running' }
        });

        try {
            // USIAMO ARRAYBUFFER (LO STESSO DELLA LENTE CHE FUNZIONA)
            const axiosConfig: any = { responseType: 'arraybuffer', timeout: 300000 };
            if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                const password = decrypt(fornitore.passwordEncrypted);
                axiosConfig.auth = { username: fornitore.username, password };
            }

            logger.info(`Scaricamento file...`);
            const response = await axios.get(fornitore.urlListino!, axiosConfig);
            const buffer = Buffer.from(response.data);

            const parseResult = await FileParserService.parseFile({
                format: fornitore.formatoFile,
                buffer: buffer,
                csvSeparator: fornitore.separatoreCSV,
                quote: fornitore.nomeFornitore.toLowerCase().includes('brevi') ? '' : '"'
            });

            logger.info(`File letto con successo: ${parseResult.totalRows} righe.`);

            // Pulizia DB
            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            let success = 0;
            const batchSize = 50; // Batch piccolissimi per Supabase

            for (let i = 0; i < parseResult.rows.length; i += batchSize) {
                const chunk = parseResult.rows.slice(i, i + batchSize);
                const toInsert = chunk.map(row => {
                    const sku = row[map['sku']] || row[map['ean']];
                    const ean = this.normalizeEAN(row[map['ean']]?.toString());
                    const prezzo = parseFloat(row[map['prezzo']]?.toString().replace(',', '.') || '0');

                    if (!sku && !ean) return null;

                    return {
                        fornitoreId,
                        skuFornitore: (sku || ean).toString().trim(),
                        eanGtin: ean,
                        descrizioneOriginale: row[map['nome']]?.toString() || null,
                        prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                        quantitaDisponibile: parseInt(row[map['quantita']] || '0'),
                        altriCampiJson: JSON.stringify(row)
                    };
                }).filter(Boolean);

                if (toInsert.length > 0) {
                    await prisma.listinoRaw.createMany({ data: toInsert as any });
                    success += toInsert.length;
                }

                if (i % 1000 === 0) {
                    logger.info(`Salvataggio: ${i}/${parseResult.totalRows}...`);
                }
            }

            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'success', prodottiProcessati: success }
            });

            return { total: parseResult.totalRows, inserted: success };

        } catch (e: any) {
            logger.error(`CRASH IMPORTAZIONE: ${e.message}`);
            await prisma.logElaborazione.update({
                where: { id: log.id },
                data: { stato: 'error', dettagliJson: JSON.stringify({ error: e.message }) }
            }).catch(() => { });

            // Messaggio che vedrai nella box rossa
            throw new AppError(`Fallimento Database/File: ${e.message}`, 500);
        }
    }

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
                const result = await this.importaListino(fornitore.id);
                results.push({ fornitore: fornitore.nomeFornitore, success: true, stats: result });
            } catch (err: any) {
                logger.error(`Errore import fornitore ${fornitore.nomeFornitore}: ${err.message}`);
                results.push({ fornitore: fornitore.nomeFornitore, success: false, error: err.message });
                totalErrors++;
            }
        }

        return { results, totalErrors };
    }
}
