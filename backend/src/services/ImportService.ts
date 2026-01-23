import prisma from '../config/database';
import { FileParserService } from './FileParserService';
import { logger } from '../utils/logger';
import axios from 'axios';

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

        try {
            logger.info(`[SERIAL IMPORT] Avvio per ${fornitore.nomeFornitore}`);

            const response = await axios.get(fornitore.urlListino, {
                responseType: 'stream',
                timeout: 900000
            });

            await prisma.listinoRaw.deleteMany({ where: { fornitoreId } });

            let success = 0;

            await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: response.data,
                csvSeparator: fornitore.separatoreCSV,
                onRow: async (row) => {
                    const sku = row[map['sku']] || row[map['ean']];
                    const prezzo = parseFloat(row[map['prezzo']]?.toString().replace(',', '.') || '0');

                    if (sku) {
                        // Unica operazione alla volta: sicurezza totale
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
                        success++;
                    }
                }
            });

            await prisma.fornitore.update({
                where: { id: fornitoreId },
                data: { ultimaSincronizzazione: new Date() }
            });

            logger.info(`[SERIAL IMPORT] Completato: ${success} prodotti.`);

        } catch (e: any) {
            logger.error(`[SERIAL IMPORT ERROR]: ${e.message}`);
        }
    }

    static async importAllListini(): Promise<any> {
        const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });
        for (const f of fornitori) {
            await this.importaListino(f.id).catch(() => { });
        }
        return { success: true };
    }
}
