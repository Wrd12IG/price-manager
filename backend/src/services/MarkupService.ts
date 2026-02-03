// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Servizio per l'applicazione delle regole di markup/pricing
 */
export class MarkupService {

    /**
     * Applica le regole di pricing a tutti i prodotti del Master File dell'utente
     */
    static async applicaRegolePrezzi(utenteId: number): Promise<{
        totalProducts: number;
        updated: number;
        errors: number;
    }> {
        if (!utenteId) throw new Error('ID Utente mancante per applicazione prezzi');
        logger.info(`💰 [Utente ${utenteId}] Inizio applicazione regole di pricing`);

        const startTime = Date.now();
        let updated = 0;
        let errors = 0;

        try {
            // 1. Recupera prodotti dell'utente
            const products = await prisma.masterFile.findMany({
                where: { utenteId },
                include: {
                    marchio: true,
                    categoria: true,
                    fornitoreSelezionato: true
                }
            });

            logger.info(`📦 Trovati ${products.length} prodotti da prezzare per utente ${utenteId}`);

            // 2. Recupera regole dell'utente
            const rules = await prisma.regolaMarkup.findMany({
                where: { utenteId, attiva: true },
                include: {
                    marchio: true,
                    categoria: true,
                    fornitore: true
                },
                orderBy: { priorita: 'asc' }
            });

            logger.info(`📋 Trovate ${rules.length} regole di pricing attive per utente ${utenteId}`);

            // 3. Applica pricing
            const BATCH_SIZE = 100;
            for (let i = 0; i < products.length; i += BATCH_SIZE) {
                const batch = products.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (product) => {
                    try {
                        const bestRule = this.findBestRule(product, rules);
                        const prezzoVendita = bestRule
                            ? this.calculatePrice(product.prezzoAcquistoMigliore, bestRule.markupPercentuale, bestRule.markupFisso, bestRule.costoSpedizione)
                            : Math.ceil(product.prezzoAcquistoMigliore);

                        await prisma.masterFile.update({
                            where: { id: product.id },
                            data: {
                                prezzoVenditaCalcolato: prezzoVendita,
                                regolaMarkupId: bestRule ? bestRule.id : null
                            }
                        });
                        updated++;
                    } catch (error) {
                        logger.error(`Errore pricing prodotto ${product.id} per utente ${utenteId}:`, error);
                        errors++;
                    }
                }));
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`✅ Pricing applicato per utente ${utenteId} in ${duration}s - Aggiornati: ${updated}, Errori: ${errors}`);

            return { totalProducts: products.length, updated, errors };

        } catch (error) {
            logger.error(`❌ Errore durante applicazione pricing per utente ${utenteId}:`, error);
            throw error;
        }
    }

    static async getRegole(utenteId: number) {
        return prisma.regolaMarkup.findMany({
            where: { utenteId },
            include: {
                fornitore: true,
                marchio: true,
                categoria: true
            },
            orderBy: { priorita: 'asc' }
        });
    }

    static async createRegola(data: any) {
        if (!data.utenteId) throw new Error('ID Utente obbligatorio');
        if (!data.tipoRegola) throw new Error('Tipo regola obbligatorio');

        return prisma.regolaMarkup.create({
            data: {
                utenteId: data.utenteId,
                fornitoreId: data.fornitoreId,
                marchioId: data.marchioId,
                categoriaId: data.categoriaId,
                tipoRegola: data.tipoRegola,
                riferimento: data.riferimento,
                markupPercentuale: data.markupPercentuale || 0,
                markupFisso: data.markupFisso || 0,
                costoSpedizione: data.costoSpedizione || 0,
                priorita: data.priorita || 100,
                attiva: true
            },
            include: {
                fornitore: true,
                marchio: true,
                categoria: true
            }
        });
    }

    static async deleteRegola(id: number, utenteId: number) {
        const r = await prisma.regolaMarkup.findFirst({ where: { id, utenteId } });
        if (!r) throw new Error('Regola non trovata o non di proprietà dell\'utente');

        await prisma.masterFile.updateMany({
            where: { regolaMarkupId: id, utenteId },
            data: { regolaMarkupId: null }
        });

        return prisma.regolaMarkup.delete({ where: { id } });
    }

    static async getAvailableOptionsForMarkup(utenteId: number, fornitoreId?: number) {
        // Filtriamo marchi e categorie basandoci sui prodotti reali dell'utente
        const where: any = { utenteId };
        if (fornitoreId) where.fornitoreSelezionatoId = fornitoreId;

        const [marcheRaw, categorieRaw] = await Promise.all([
            prisma.masterFile.findMany({
                where,
                select: { marchio: true },
                distinct: ['marchioId']
            }),
            prisma.masterFile.findMany({
                where,
                select: { categoria: true },
                distinct: ['categoriaId']
            })
        ]);

        return {
            marche: marcheRaw.map(m => m.marchio).filter(Boolean),
            categorie: categorieRaw.map(c => c.categoria).filter(Boolean)
        };
    }

    private static findBestRule(product: any, rules: any[]): any | null {
        let bestRule = rules.find(r => r.tipoRegola === 'prodotto_specifico' && r.riferimento === product.eanGtin);
        if (bestRule) return bestRule;

        bestRule = rules.find(r => r.marchioId === product.marchioId && r.categoriaId === product.categoriaId && r.marchioId !== null && r.categoriaId !== null);
        if (bestRule) return bestRule;

        bestRule = rules.find(r => r.marchioId === product.marchioId && r.marchioId !== null && r.categoriaId === null);
        if (bestRule) return bestRule;

        bestRule = rules.find(r => r.categoriaId === product.categoriaId && r.categoriaId !== null && r.marchioId === null);
        if (bestRule) return bestRule;

        bestRule = rules.find(r => r.fornitoreId === product.fornitoreSelezionatoId && r.fornitoreId !== null);
        if (bestRule) return bestRule;

        bestRule = rules.find(r => r.tipoRegola === 'default' && r.fornitoreId === null && r.marchioId === null && r.categoriaId === null);
        return bestRule || null;
    }

    private static calculatePrice(pi: number, mp: number, mf: number, cs: number): number {
        const base = pi + cs;
        return Math.ceil(base * (1 + mp / 100) + mf);
    }
}
