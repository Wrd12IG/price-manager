import { Request, Response } from 'express';
import { productFilterService, FilterCriteria } from '../services/ProductFilterService';
import { MasterFileService } from '../services/MasterFileService';
import { IcecatUtils } from '../utils/IcecatUtils';
import prisma from '../config/database';

/**
 * Controller per la gestione delle regole di filtro prodotti
 */
export class ProductFilterController {

    /**
     * GET /api/filters/rules
     * Ottiene tutte le regole di filtro
     */
    async getRules(req: Request, res: Response) {
        try {
            const { active } = req.query;

            let rules;
            if (active === 'true') {
                rules = await productFilterService.getActiveRules();
            } else {
                rules = await prisma.productFilterRule.findMany({
                    include: {
                        marchio: true,
                        categoria: true
                    },
                    orderBy: [
                        { priorita: 'asc' },
                        { nome: 'asc' }
                    ]
                });
            }

            // Calcola i match per ogni regola
            const counts = await productFilterService.getRuleMatchCounts();

            // Aggiungi il conteggio ai dati della regola
            const rulesWithCounts = rules.map((r: any) => ({
                ...r,
                matchedCount: counts[r.id] || 0
            }));

            res.json({
                success: true,
                data: rulesWithCounts,
                count: rulesWithCounts.length
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/filters/rules
     * Crea una nuova regola di filtro
     */
    async createRule(req: Request, res: Response) {
        try {
            const { nome, marchioId, categoriaId, azione, priorita, attiva, note } = req.body;

            // Validazione
            if (!nome) {
                res.status(400).json({
                    success: false,
                    error: 'Nome è obbligatorio'
                });
                return;
            }

            const rule = await productFilterService.createRule({
                nome,
                marchioId,
                categoriaId,
                azione,
                priorita,
                attiva,
                note
            });

            res.status(201).json({
                success: true,
                data: rule,
                message: 'Regola creata con successo'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ... updateRule (omesso per brevità, ma dovrebbe essere simile se accetta update parziali) ...
    // In realtà updateRule usa req.body diretto, quindi se il service accetta i campi, va bene.

    /**
     * GET /api/filters/facets
     * Ottiene i conteggi dinamici per i filtri basati sui criteri attuali
     */
    async getFacetCounts(req: Request, res: Response) {
        try {
            const { brands, categories } = req.query;

            // Parsa i criteri dalla query string
            const criteria: FilterCriteria = {
                brands: brands ? (Array.isArray(brands) ? brands as string[] : [brands as string]) : [],
                categories: categories ? (Array.isArray(categories) ? categories as string[] : [categories as string]) : []
            };

            // Recupera tutti i prodotti necessari per il calcolo
            const products = await prisma.masterFile.findMany({
                select: {
                    marchio: { select: { nome: true } },
                    categoria: { select: { nome: true } },
                    datiIcecat: {
                        select: { specificheTecnicheJson: true }
                    },
                    outputShopify: {
                        select: { productType: true }
                    }
                }
            });

            // Normalizza i prodotti per il servizio
            const normalizedProducts = products.map(p => {
                let brand = p.marchio?.nome;
                // Fallback a Icecat se manca marchio (anche se ora dovrebbe esserci)
                if (!brand && p.datiIcecat?.specificheTecnicheJson) {
                    try {
                        const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                        const extracted = IcecatUtils.extractBrandFromFeatures(specs);
                        if (extracted) brand = extracted;
                    } catch (e) { }
                }

                return {
                    brand: brand,
                    category: p.categoria?.nome || p.outputShopify?.productType
                };
            });

            const facets = await productFilterService.getFacetCounts(normalizedProducts, criteria);

            res.json({
                success: true,
                data: facets
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/filters/options
     * Ottiene le opzioni disponibili per i filtri (marche e categorie)
     */
    async getOptions(req: Request, res: Response) {
        try {
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

            res.json({
                success: true,
                data: {
                    marche,
                    categorie
                }
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * PUT /api/filters/rules/:id
     * Aggiorna una regola esistente
     */
    async updateRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { nome, marchioId, categoriaId, azione, priorita, attiva, note } = req.body;

            const rule = await productFilterService.updateRule(parseInt(id), {
                nome,
                marchioId,
                categoriaId,
                azione,
                priorita,
                attiva,
                note
            });

            res.json({
                success: true,
                data: rule,
                message: 'Regola aggiornata con successo'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * DELETE /api/filters/rules/:id
     * Elimina una regola
     */
    async deleteRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await productFilterService.deleteRule(parseInt(id));

            res.json({
                success: true,
                message: 'Regola eliminata con successo'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/filters/rules/:id/toggle
     * Attiva/disattiva una regola
     */
    async toggleRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { attiva } = req.body;

            const rule = await productFilterService.toggleRule(parseInt(id), attiva);

            res.json({
                success: true,
                data: rule,
                message: `Regola ${attiva ? 'attivata' : 'disattivata'} con successo`
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/filters/test
     * Testa un singolo prodotto contro le regole attive
     */
    async testFilter(req: Request, res: Response) {
        try {
            const { brand, category } = req.body;

            const result = await productFilterService.shouldIncludeProduct(
                brand || null,
                category || null
            );

            res.json({
                success: true,
                data: result
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/filters/batch-test
     * Testa un batch di prodotti
     */
    async batchTestFilter(req: Request, res: Response) {
        try {
            const { products } = req.body;

            if (!Array.isArray(products)) {
                res.status(400).json({
                    success: false,
                    error: 'products deve essere un array'
                });
                return;
            }

            const results = await Promise.all(
                products.map(async (p: any) => {
                    const result = await productFilterService.shouldIncludeProduct(
                        p.brand || null,
                        p.category || null
                    );
                    return {
                        product: p,
                        result
                    };
                })
            );

            res.json({
                success: true,
                data: results
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/filters/presets
     * Ottiene tutti i preset
     */
    async getPresets(req: Request, res: Response) {
        try {
            const presets = await prisma.filterPreset.findMany({
                orderBy: { nome: 'asc' }
            });

            res.json({
                success: true,
                data: presets
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/filters/presets/active
     * Ottiene il preset attivo
     */
    async getActivePreset(req: Request, res: Response) {
        try {
            const preset = await prisma.filterPreset.findFirst({
                where: { attivo: true }
            });

            res.json({
                success: true,
                data: preset
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/filters/presets/:id/activate
     * Attiva un preset
     */
    async activatePreset(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Disattiva tutti i preset
            await prisma.filterPreset.updateMany({
                data: { attivo: false }
            });

            // Attiva il preset selezionato
            const preset = await prisma.filterPreset.update({
                where: { id: parseInt(id) },
                data: { attivo: true }
            });

            res.json({
                success: true,
                data: preset,
                message: 'Preset attivato con successo'
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}


export const productFilterController = new ProductFilterController();
