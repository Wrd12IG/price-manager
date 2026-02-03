// @ts-nocheck
import { Response } from 'express';
import { productFilterService, FilterCriteria } from '../services/ProductFilterService';
import { MasterFileService } from '../services/MasterFileService';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Controller per la gestione delle regole di filtro prodotti (Multi-Tenant)
 */
export class ProductFilterController {

    async getRules(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { active } = req.query;

            let rules;
            if (active === 'true') {
                rules = await productFilterService.getActiveRules(utenteId);
            } else {
                rules = await prisma.productFilterRule.findMany({
                    where: { utenteId },
                    include: { marchio: true, categoria: true },
                    orderBy: [{ priorita: 'asc' }, { nome: 'asc' }]
                });
            }

            const counts = await productFilterService.getRuleMatchCounts(utenteId);
            const rulesWithCounts = rules.map((r: any) => ({
                ...r,
                matchedCount: counts[r.id] || 0
            }));

            res.json({ success: true, data: rulesWithCounts, count: rulesWithCounts.length });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async createRule(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { nome, marchioId, categoriaId, azione, priorita, attiva, note } = req.body;

            if (!nome) return res.status(400).json({ success: false, error: 'Nome è obbligatorio' });

            const rule = await productFilterService.createRule(utenteId, {
                nome, marchioId, categoriaId, azione, priorita, attiva, note
            });

            MasterFileService.consolidaMasterFile(utenteId).catch(err => console.error('Error background consolidation:', err));

            res.status(201).json({ success: true, data: rule, message: 'Regola creata con successo.' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getFacetCounts(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { brands, categories } = req.query;

            const criteria: FilterCriteria = {
                brands: brands ? (Array.isArray(brands) ? brands as string[] : [brands as string]) : [],
                categories: categories ? (Array.isArray(categories) ? categories as string[] : [categories as string]) : []
            };

            const products = await prisma.masterFile.findMany({
                where: { utenteId },
                select: { marchio: { select: { nome: true } }, categoria: { select: { nome: true } } }
            });

            const normalizedProducts = products.map(p => ({
                brand: p.marchio?.nome,
                category: p.categoria?.nome
            }));

            const facets = await productFilterService.getFacetCounts(normalizedProducts, criteria);
            res.json({ success: true, data: facets });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getOptions(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const [marcheRaw, categorieRaw] = await Promise.all([
                prisma.masterFile.findMany({
                    where: { utenteId },
                    select: { marchio: true },
                    distinct: ['marchioId']
                }),
                prisma.masterFile.findMany({
                    where: { utenteId },
                    select: { categoria: true },
                    distinct: ['categoriaId']
                })
            ]);

            res.json({
                success: true,
                data: {
                    marche: marcheRaw.map(m => m.marchio).filter(Boolean),
                    categorie: categorieRaw.map(c => c.categoria).filter(Boolean)
                }
            });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async updateRule(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { id } = req.params;
            const rule = await productFilterService.updateRule(utenteId, parseInt(id), req.body);
            MasterFileService.consolidaMasterFile(utenteId).catch(err => console.error('Error background consolidation:', err));
            res.json({ success: true, data: rule, message: 'Regola aggiornata.' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deleteRule(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { id } = req.params;
            await productFilterService.deleteRule(utenteId, parseInt(id));
            MasterFileService.consolidaMasterFile(utenteId).catch(err => console.error('Error background consolidation:', err));
            res.json({ success: true, message: 'Regola eliminata.' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async toggleRule(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { id } = req.params;
            const { attiva } = req.body;
            const rule = await productFilterService.toggleRule(utenteId, parseInt(id), attiva);
            MasterFileService.consolidaMasterFile(utenteId).catch(err => console.error('Error background consolidation:', err));
            res.json({ success: true, data: rule, message: `Regola ${attiva ? 'attivata' : 'disattivata'}.` });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async testFilter(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const result = await productFilterService.shouldIncludeProduct(utenteId, req.body.brand, req.body.category);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async batchTestFilter(req: AuthRequest, res: Response) {
        try {
            const utenteId = req.utenteId;
            const { products } = req.body;
            if (!Array.isArray(products)) return res.status(400).json({ success: false, error: 'products deve essere un array' });
            const results = await Promise.all(products.map(async (p: any) => {
                const result = await productFilterService.shouldIncludeProduct(utenteId, p.brand || null, p.category || null);
                return { product: p, result };
            }));
            res.json({ success: true, data: results });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getPresets(req: AuthRequest, res: Response) {
        try {
            const presets = await prisma.filterPreset.findMany({ orderBy: { nome: 'asc' } });
            res.json({ success: true, data: presets });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getActivePreset(req: AuthRequest, res: Response) {
        try {
            const preset = await prisma.filterPreset.findFirst({ where: { attivo: true } });
            res.json({ success: true, data: preset });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async activatePreset(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const utenteId = req.utenteId;
            await prisma.filterPreset.updateMany({ data: { attivo: false } });
            const preset = await prisma.filterPreset.update({ where: { id: parseInt(id) }, data: { attivo: true } });
            res.json({ success: true, data: preset, message: 'Preset attivato.' });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

export const productFilterController = new ProductFilterController();
