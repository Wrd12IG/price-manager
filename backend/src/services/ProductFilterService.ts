// @ts-nocheck
import prisma from '../config/database';
import { ProductFilterRule } from '@prisma/client';

export interface FilterResult {
    shouldInclude: boolean;
    matchedRules?: string[];
    reason?: string;
}

export interface FilterCriteria {
    brands: string[];
    categories: string[];
}

export class ProductFilterService {

    async evaluateRules(
        utenteId: number,
        rules: ProductFilterRule[],
        brand: string | null,
        category: string | null
    ): Promise<FilterResult> {
        if (rules.length === 0) return { shouldInclude: true, reason: 'Nessuna regola' };

        const includeRules = rules.filter(r => r.azione === 'include');
        const excludeRules = rules.filter(r => r.azione === 'exclude');

        for (const rule of excludeRules) {
            const rBrand = (rule as any).marchio?.nome || null;
            const rCat = (rule as any).categoria?.nome || null;

            const matchesBrand = rBrand ? (brand?.toUpperCase() === rBrand.toUpperCase()) : true;
            const matchesCategory = rCat ? (category?.toUpperCase() === rCat.toUpperCase()) : true;

            if (matchesBrand && matchesCategory) {
                return { shouldInclude: false, reason: `Escluso da: ${rule.nome}` };
            }
        }

        if (includeRules.length === 0) return { shouldInclude: true };

        for (const rule of includeRules) {
            const rBrand = (rule as any).marchio?.nome || null;
            const rCat = (rule as any).categoria?.nome || null;

            const matchesBrand = rBrand ? (brand?.toUpperCase() === rBrand.toUpperCase()) : true;
            const matchesCategory = rCat ? (category?.toUpperCase() === rCat.toUpperCase()) : true;

            if (matchesBrand && matchesCategory) {
                return { shouldInclude: true, reason: `Incluso da: ${rule.nome}` };
            }
        }

        return { shouldInclude: false, reason: 'Nessuna regola di inclusione soddisfatta' };
    }

    async shouldIncludeProduct(utenteId: number, brand: string | null, category: string | null): Promise<FilterResult> {
        const rules = await this.getActiveRules(utenteId);
        return this.evaluateRules(utenteId, rules, brand, category);
    }

    async getActiveRules(utenteId: number) {
        return prisma.productFilterRule.findMany({
            where: { utenteId, attiva: true },
            include: { marchio: true, categoria: true },
            orderBy: [{ priorita: 'asc' }, { nome: 'asc' }]
        });
    }

    async createRule(utenteId: number, data: any) {
        return prisma.productFilterRule.create({
            data: { ...data, utenteId }
        });
    }

    async updateRule(utenteId: number, id: number, data: any) {
        await prisma.productFilterRule.updateMany({
            where: { id, utenteId },
            data
        });
        return prisma.productFilterRule.findFirst({ where: { id, utenteId } });
    }

    async deleteRule(utenteId: number, id: number) {
        return prisma.productFilterRule.deleteMany({
            where: { id, utenteId }
        });
    }

    async toggleRule(utenteId: number, id: number, attiva: boolean) {
        await prisma.productFilterRule.updateMany({
            where: { id, utenteId },
            data: { attiva }
        });
        return prisma.productFilterRule.findFirst({ where: { id, utenteId } });
    }

    async getRuleMatchCounts(utenteId: number): Promise<Record<number, number>> {
        const rules = await prisma.productFilterRule.findMany({ where: { utenteId }, include: { marchio: true, categoria: true } });
        const rawProducts = await prisma.listinoRaw.findMany({ where: { utenteId }, select: { marca: true, categoriaFornitore: true } });

        const counts: Record<number, number> = {};
        rules.forEach(r => counts[r.id] = 0);

        for (const p of rawProducts) {
            for (const r of rules) {
                const rBrand = (r as any).marchio?.nome || null;
                const rCat = (r as any).categoria?.nome || null;
                const matchesBrand = rBrand ? (p.marca?.toUpperCase() === rBrand.toUpperCase()) : true;
                const matchesCat = rCat ? (p.categoriaFornitore?.toUpperCase() === rCat.toUpperCase()) : true;
                if (matchesBrand && matchesCat) counts[r.id]++;
            }
        }
        return counts;
    }

    async getFacetCounts(products: any[], criteria: FilterCriteria) {
        const facets = { brands: {} as any, categories: {} as any };
        products.forEach(p => {
            if (p.brand) facets.brands[p.brand] = (facets.brands[p.brand] || 0) + 1;
            if (p.category) facets.categories[p.category] = (facets.categories[p.category] || 0) + 1;
        });
        return facets;
    }
}

export const productFilterService = new ProductFilterService();
