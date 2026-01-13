import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Servizio per l'applicazione delle regole di markup/pricing
 */
export class MarkupService {

    /**
     * Applica le regole di pricing a tutti i prodotti del Master File
     */
    static async applicaRegolePrezzi(): Promise<{
        totalProducts: number;
        updated: number;
        errors: number;
    }> {
        logger.info('💰 Inizio applicazione regole di pricing');

        const startTime = Date.now();
        let updated = 0;
        let errors = 0;

        try {
            // Recupera tutti i prodotti dal Master File
            const products = await prisma.masterFile.findMany({
                include: {
                    marchio: true,
                    categoria: true,
                    fornitoreSelezionato: true
                }
            });

            logger.info(`📦 Trovati ${products.length} prodotti da prezzare`);

            // Recupera tutte le regole attive ordinate per priorità
            const rules = await prisma.regolaMarkup.findMany({
                where: { attiva: true },
                include: {
                    marchio: true,
                    categoria: true,
                    fornitore: true
                },
                orderBy: { priorita: 'asc' }
            });

            logger.info(`📋 Trovate ${rules.length} regole di pricing attive`);

            // Applica pricing a ogni prodotto
            for (const product of products) {
                try {
                    const bestRule = this.findBestRule(product, rules);

                    if (bestRule) {
                        const prezzoVendita = this.calculatePrice(
                            product.prezzoAcquistoMigliore,
                            bestRule.markupPercentuale,
                            bestRule.markupFisso,
                            bestRule.costoSpedizione
                        );

                        // Aggiorna il prodotto con il nuovo prezzo
                        await prisma.masterFile.update({
                            where: { id: product.id },
                            data: {
                                prezzoVenditaCalcolato: prezzoVendita,
                                regolaMarkupId: bestRule.id
                            }
                        });

                        updated++;
                    } else {
                        // Nessuna regola trovata, usa markup 0% (prezzo vendita = prezzo acquisto)
                        const prezzoVendita = Math.ceil(product.prezzoAcquistoMigliore);

                        await prisma.masterFile.update({
                            where: { id: product.id },
                            data: {
                                prezzoVenditaCalcolato: prezzoVendita,
                                regolaMarkupId: null
                            }
                        });

                        updated++;
                    }
                } catch (error) {
                    logger.error(`Errore applicazione pricing per prodotto ${product.id}:`, error);
                    errors++;
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`✅ Pricing applicato in ${duration}s - Aggiornati: ${updated}, Errori: ${errors}`);

            return {
                totalProducts: products.length,
                updated,
                errors
            };

        } catch (error) {
            logger.error('❌ Errore durante applicazione pricing:', error);
            throw error;
        }
    }

    /**
     * Recupera tutte le regole di markup
     */
    static async getRegole() {
        return prisma.regolaMarkup.findMany({
            include: {
                fornitore: true,
                marchio: true,
                categoria: true
            },
            orderBy: { priorita: 'asc' }
        });
    }

    /**
     * Crea una nuova regola di markup
     */
    static async createRegola(data: any) {
        // Validazione base
        if (!data.tipoRegola) {
            throw new Error('Tipo regola obbligatorio');
        }

        return prisma.regolaMarkup.create({
            data: {
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

    /**
     * Elimina una regola di markup
     */
    static async deleteRegola(id: number) {
        // Prima scollega la regola dai prodotti che la usano (per evitare FK constraint error)
        await prisma.masterFile.updateMany({
            where: { regolaMarkupId: id },
            data: {
                regolaMarkupId: null,
                // Opzionale: potremmo resettare anche il prezzo, ma applicaRegolePrezzi lo farà dopo
            }
        });

        return prisma.regolaMarkup.delete({
            where: { id }
        });
    }

    /**
     * Recupera le opzioni disponibili per le regole (marche, categorie)
     * Opzionalmente filtrate per fornitore
     */
    static async getAvailableOptionsForMarkup(fornitoreId?: number) {
        // Se c'è un fornitore, potremmo voler filtrare le marche/categorie disponibili per quel fornitore
        // Per ora restituiamo tutte le marche e categorie attive

        const [marche, categorie] = await Promise.all([
            prisma.marchio.findMany({
                where: { attivo: true },
                orderBy: { nome: 'asc' }
            }),
            prisma.categoria.findMany({
                where: { attivo: true },
                orderBy: { nome: 'asc' }
            })
        ]);

        return {
            marche,
            categorie
        };
    }

    /**
     * Trova la regola di markup più specifica per un prodotto
     * Priorità: Prodotto specifico > Marca+Categoria > Marca > Categoria > Fornitore > Default
     */
    private static findBestRule(product: any, rules: any[]): any | null {
        // 1. Cerca regola per prodotto specifico (EAN)
        let bestRule = rules.find(r =>
            r.tipoRegola === 'prodotto_specifico' &&
            r.riferimento === product.eanGtin
        );
        if (bestRule) return bestRule;

        // 2. Cerca regola per Marca + Categoria
        bestRule = rules.find(r =>
            r.marchioId === product.marchioId &&
            r.categoriaId === product.categoriaId &&
            r.marchioId !== null &&
            r.categoriaId !== null
        );
        if (bestRule) return bestRule;

        // 3. Cerca regola per Marca
        bestRule = rules.find(r =>
            r.marchioId === product.marchioId &&
            r.marchioId !== null &&
            r.categoriaId === null
        );
        if (bestRule) return bestRule;

        // 4. Cerca regola per Categoria
        bestRule = rules.find(r =>
            r.categoriaId === product.categoriaId &&
            r.categoriaId !== null &&
            r.marchioId === null
        );
        if (bestRule) return bestRule;

        // 5. Cerca regola per Fornitore
        bestRule = rules.find(r =>
            r.fornitoreId === product.fornitoreSelezionatoId &&
            r.fornitoreId !== null
        );
        if (bestRule) return bestRule;

        // 6. Cerca regola default
        bestRule = rules.find(r =>
            r.tipoRegola === 'default' &&
            r.fornitoreId === null &&
            r.marchioId === null &&
            r.categoriaId === null
        );

        return bestRule || null;
    }

    /**
     * Calcola il prezzo di vendita applicando markup
     */
    private static calculatePrice(
        prezzoAcquisto: number,
        markupPercentuale: number,
        markupFisso: number,
        costoSpedizione: number
    ): number {
        // Formula: (Prezzo Acquisto + Spedizione) * (1 + Markup%) + Markup Fisso
        const prezzoBase = prezzoAcquisto + costoSpedizione;
        const prezzoConPercentuale = prezzoBase * (1 + markupPercentuale / 100);
        const prezzoFinale = prezzoConPercentuale + markupFisso;

        // Arrotonda per eccesso senza decimali (es. 10.1 -> 11, 10.9 -> 11)
        return Math.ceil(prezzoFinale);
    }
}
