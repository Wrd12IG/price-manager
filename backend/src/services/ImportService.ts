import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class ImportService {
    static async importaListino(fornitoreId: number): Promise<void> {
        const fornitore = await prisma.fornitore.findUnique({
            where: { id: fornitoreId },
            include: { mappatureCampi: true }
        });

        if (!fornitore || !fornitore.urlListino) return;

        const map = fornitore.mappatureCampi.reduce((acc: any, m) => {
            acc[m.campoStandard] = m.campoOriginale;
            return acc;
        }, {});

        // Creiamo un file temporaneo per non occupare RAM
        const tempFilePath = path.join(os.tmpdir(), `import_${fornitoreId}_${Date.now()}.csv`);

        try {
            logger.info(`[IMPORT] Scaricamento file su disco temporaneo: ${tempFilePath}`);

            // Scarichiamo il file pezzetto per pezzetto direttamente su disco
            const response = await axios({
                method: 'GET',
                url: fornitore.urlListino,
                responseType: 'stream',
                timeout: 900000
            });

            const writer = fs.createWriteStream(tempFilePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            logger.info(`[IMPORT] Scaricamento completato. Inizio parsing...`);

            // Pulizia database prima di iniziare
            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            // Parsing dal FILE (RAM quasi a zero)
            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: fs.createReadStream(tempFilePath),
                csvSeparator: fornitore.separatoreCSV,
                onRow: async (row) => {
                    const sku = row[map['sku']] || row[map['ean']];
                    const prezzo = parseFloat(row[map['prezzo']]?.toString().replace(',', '.') || '0');

                    if (sku) {
                        await prisma.listinoRaw.create({
                            data: {
                                fornitoreId,
                                skuFornitore: sku.toString().trim(),
                                eanGtin: row[map['ean']]?.toString().trim() || null,
                                prezzoAcquisto: isNaN(prezzo) ? 0 : prezzo,
                                quantitaDisponibile: parseInt(row[map['quantita']] || '0'),
                                descrizioneOriginale: row[map['nome']]?.toString() || null,
                                altriCampiJson: JSON.stringify(row)
                            }
                        }).catch(() => { });
                    }
                }
            });

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            logger.info(`[IMPORT] Successo per fornitore ${fornitoreId}`);

        } catch (e: any) {
            logger.error(`[IMPORT CRITICAL ERROR]: ${e.message}`);
        } finally {
            // Puliamo il file temporaneo
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }

    static async importAllListini(): Promise<any> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        for (const f of fornitori) {
            this.importaListino(f.id);
        }
        return { success: true };
    }
}
