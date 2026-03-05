// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * #14 — Prezzo Competitivo Automatico
 * Intelligence di pricing basato su:
 * 1. Dati interni (min/max/avg costo di acquisto per categoria × brand)
 * 2. Prezzi competitor inseriti manualmente o via tracking
 * 3. Regole di posizionamento configurabili
 */
export class CompetitivePricingService {

    /**
     * Suggerisce un prezzo di vendita competitivo per un prodotto.
     * Combina:
     * - Prezzi competitor registrati (se disponibili)
     * - Media mercato calcolata sui costi di acquisto del catalogo
     * - Regole di posizionamento configurate
     */
    static async suggestCompetitivePrice(
        utenteId: number,
        masterFileId: number
    ): Promise<{
        suggestedPrice: number;
        confidence: 'high' | 'medium' | 'low';
        sources: Array<{ source: string; price: number; label?: string }>;
        analysis: string;
        positioning: string;
    }> {
        const product = await prisma.masterFile.findFirst({
            where: { id: masterFileId, utenteId },
            include: {
                marchio: { select: { nome: true } },
                categoria: { select: { nome: true } }
            }
        });
        if (!product) throw new Error('Prodotto non trovato');

        const sources: Array<{ source: string; price: number; label?: string }> = [];

        // 1. Prezzi competitor registrati per questo prodotto
        const competitorPrices = await (prisma as any).competitorPrice.findMany({
            where: {
                utenteId,
                OR: [
                    { masterFileId },
                    ...(product.eanGtin ? [{ eanGtin: product.eanGtin }] : []),
                    ...(product.partNumber ? [{ partNumber: product.partNumber }] : [])
                ]
            },
            orderBy: { rilevatoAt: 'desc' },
            take: 10
        });

        for (const cp of competitorPrices) {
            sources.push({
                source: cp.source,
                price: cp.prezzoRilevato,
                label: cp.sourceLabel || cp.source
            });
        }

        // 2. Analisi mercato interno: prodotti simili (stessa marca + categoria)
        const marketPeers = await prisma.masterFile.findMany({
            where: {
                utenteId,
                marchioId: product.marchioId ?? undefined,
                categoriaId: product.categoriaId ?? undefined,
                prezzoVenditaCalcolato: { gt: 0 },
                id: { not: masterFileId }
            },
            select: { prezzoAcquistoMigliore: true, prezzoVenditaCalcolato: true },
            take: 100
        });

        let marketAvgMarkup = 0.30; // default 30%
        if (marketPeers.length >= 3) {
            const markups = marketPeers
                .filter(p => p.prezzoAcquistoMigliore > 0 && p.prezzoVenditaCalcolato > 0)
                .map(p => (p.prezzoVenditaCalcolato - p.prezzoAcquistoMigliore) / p.prezzoAcquistoMigliore);
            if (markups.length > 0) {
                marketAvgMarkup = markups.reduce((a, b) => a + b, 0) / markups.length;
            }
        }

        // 3. Leggi regola di posizionamento configurata
        const positioningCfg = await prisma.configurazioneSistema.findFirst({
            where: { utenteId, chiave: 'competitive_pricing_rule' }
        });
        const rule = positioningCfg?.valore ? JSON.parse(positioningCfg.valore) : {
            mode: 'market_avg',    // 'market_avg' | 'below_cheapest' | 'above_avg'
            delta: 0,              // % relativo al prezzo di riferimento
            minMarginPct: 15       // margine minimo garantito
        };

        const costPrice = product.prezzoAcquistoMigliore || 0;
        let suggestedPrice = 0;
        let confidence: 'high' | 'medium' | 'low' = 'low';
        let analysis = '';
        let positioning = '';

        if (competitorPrices.length >= 2) {
            // Alta confidenza: prezzi competitor reali disponibili
            const competitorPriceVals = competitorPrices.map((c: any) => c.prezzoRilevato);
            const minCompetitor = Math.min(...competitorPriceVals);
            const avgCompetitor = competitorPriceVals.reduce((a: number, b: number) => a + b, 0) / competitorPriceVals.length;

            if (rule.mode === 'below_cheapest') {
                suggestedPrice = minCompetitor * (1 - Math.abs(rule.delta || 0) / 100);
            } else if (rule.mode === 'above_avg') {
                suggestedPrice = avgCompetitor * (1 + (rule.delta || 0) / 100);
            } else {
                suggestedPrice = avgCompetitor * (1 + (rule.delta || 0) / 100);
            }
            confidence = 'high';
            analysis = `Basato su ${competitorPrices.length} prezzi competitor. Min: €${minCompetitor.toFixed(2)}, Media: €${avgCompetitor.toFixed(2)}.`;
            positioning = rule.mode === 'below_cheapest' ? 'Più economico del concorrente più basso' :
                rule.mode === 'above_avg' ? 'Sopra la media di mercato' : 'In linea con la media di mercato';

        } else if (marketPeers.length >= 5) {
            // Media confidenza: dati di mercato interni
            suggestedPrice = costPrice * (1 + marketAvgMarkup) * (1 + (rule.delta || 0) / 100);
            confidence = 'medium';
            analysis = `Basato su ${marketPeers.length} prodotti simili nel catalogo. Markup medio di mercato: ${(marketAvgMarkup * 100).toFixed(1)}%.`;
            positioning = 'Allineato al markup medio del catalogo';
        } else {
            // Bassa confidenza: solo markup di default
            const defaultMarkup = 0.30;
            suggestedPrice = costPrice * (1 + defaultMarkup);
            confidence = 'low';
            analysis = `Dati di mercato insufficienti. Applicato markup di default ${(defaultMarkup * 100).toFixed(0)}%.`;
            positioning = 'Markup di default applicato';
        }

        // Garantisce margine minimo
        const minPrice = costPrice * (1 + (rule.minMarginPct || 15) / 100);
        if (suggestedPrice < minPrice) {
            suggestedPrice = minPrice;
            analysis += ` ⚠️ Prezzo alzato al minimo di margine (${rule.minMarginPct || 15}%).`;
        }

        return {
            suggestedPrice: Math.round(suggestedPrice * 100) / 100,
            confidence,
            sources,
            analysis,
            positioning
        };
    }

    /**
     * Aggiunge o aggiorna un prezzo competitor manualmente.
     */
    static async addCompetitorPrice(
        utenteId: number,
        data: {
            masterFileId?: number;
            eanGtin?: string;
            partNumber?: string;
            source: string;
            sourceLabel?: string;
            prezzoRilevato: number;
            url?: string;
        }
    ): Promise<any> {
        return (prisma as any).competitorPrice.create({
            data: { utenteId, ...data }
        });
    }

    /**
     * Lista prezzi competitor per un prodotto.
     */
    static async getCompetitorPrices(utenteId: number, masterFileId: number): Promise<any[]> {
        const product = await prisma.masterFile.findFirst({ where: { id: masterFileId, utenteId } });
        if (!product) return [];

        return (prisma as any).competitorPrice.findMany({
            where: {
                utenteId,
                OR: [
                    { masterFileId },
                    ...(product.eanGtin ? [{ eanGtin: product.eanGtin }] : []),
                ]
            },
            orderBy: { rilevatoAt: 'desc' },
            take: 20
        });
    }

    /**
     * Rimuove un prezzo competitor.
     */
    static async deleteCompetitorPrice(utenteId: number, id: number): Promise<void> {
        const existing = await (prisma as any).competitorPrice.findFirst({ where: { id, utenteId } });
        if (!existing) throw new Error('Prezzo competitor non trovato o non autorizzato');
        await (prisma as any).competitorPrice.delete({ where: { id } });
    }

    /**
     * Salva la regola di posizionamento competitivo per l'utente.
     */
    static async savePositioningRule(
        utenteId: number,
        rule: { mode: string; delta: number; minMarginPct: number }
    ): Promise<void> {
        await prisma.configurazioneSistema.upsert({
            where: { utenteId_chiave: { utenteId, chiave: 'competitive_pricing_rule' } },
            update: { valore: JSON.stringify(rule) },
            create: { utenteId, chiave: 'competitive_pricing_rule', valore: JSON.stringify(rule), tipo: 'json', descrizione: 'Regola posizionamento prezzo competitivo' }
        });
    }

    /**
     * Mostra statistiche di mercato per categoria+marca.
     */
    static async getMarketStats(
        utenteId: number,
        marchioId?: number,
        categoriaId?: number
    ): Promise<{
        count: number;
        avgCost: number;
        minCost: number;
        maxCost: number;
        avgSellPrice: number;
        avgMarkupPct: number;
    }> {
        const where: any = { utenteId, prezzoAcquistoMigliore: { gt: 0 } };
        if (marchioId) where.marchioId = marchioId;
        if (categoriaId) where.categoriaId = categoriaId;

        const products = await prisma.masterFile.findMany({
            where,
            select: { prezzoAcquistoMigliore: true, prezzoVenditaCalcolato: true }
        });

        if (products.length === 0) {
            return { count: 0, avgCost: 0, minCost: 0, maxCost: 0, avgSellPrice: 0, avgMarkupPct: 0 };
        }

        const costs = products.map(p => p.prezzoAcquistoMigliore);
        const sells = products.filter(p => p.prezzoVenditaCalcolato > 0).map(p => p.prezzoVenditaCalcolato);
        const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
        const avgSellPrice = sells.length > 0 ? sells.reduce((a, b) => a + b, 0) / sells.length : 0;
        const avgMarkupPct = avgCost > 0 && avgSellPrice > 0
            ? ((avgSellPrice - avgCost) / avgCost) * 100
            : 0;

        return {
            count: products.length,
            avgCost: Math.round(avgCost * 100) / 100,
            minCost: Math.round(Math.min(...costs) * 100) / 100,
            maxCost: Math.round(Math.max(...costs) * 100) / 100,
            avgSellPrice: Math.round(avgSellPrice * 100) / 100,
            avgMarkupPct: Math.round(avgMarkupPct * 10) / 10
        };
    }
}
