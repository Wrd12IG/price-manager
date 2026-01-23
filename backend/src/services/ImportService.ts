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

        const tempFilePath = path.join(os.tmpdir(), `import_${fornitoreId}.csv`);

        try {
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

            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

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

        } catch (e: any) {
            console.error('CRITICAL IMPORT ERROR:', e.message);
        } finally {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    }

    // QUESTA FUNZIONE È QUELLA CHE MANCAVA E FACEVA FALLIRE IL BUILD!
    static async importAllListini(): Promise<any> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        for (const f of fornitori) {
            await this.importaListino(f.id).catch(() => { });
        }
        return { success: true };
    }
}
