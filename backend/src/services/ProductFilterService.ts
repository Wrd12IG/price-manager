import prisma from '../config/database';
import { ProductFilterRule } from '@prisma/client';
import { IcecatUtils } from '../utils/IcecatUtils';

export interface FilterResult {
    shouldInclude: boolean;
    matchedRules?: string[];
    reason?: string;
}

export interface FilterCriteria {
    brands?: string[];      // OR interno: [Asus, Dell] → Asus OR Dell
    categories?: string[];  // OR interno: [Notebook, Desktop] → Notebook OR Desktop
}

export interface FacetCount {
    value: string;
    count: number;
    disabled: boolean;
}

/**
 * Mappa degli alias per i brand - permette di riconoscere varianti dello stesso marchio
 * Chiave: nome normalizzato (uppercase), Valore: array di alias equivalenti
 */
const BRAND_ALIASES: Record<string, string[]> = {
    'ASUS': ['ASUSTEK', 'ASUS COMPUTER', 'ASUS TEK'],
    'HP': ['HEWLETT-PACKARD', 'HEWLETT PACKARD', 'HPE', 'HP INC'],
    'DELL': ['DELL TECHNOLOGIES', 'DELL INC'],
    'LENOVO': ['LENOVO GROUP', 'LENOVO INC'],
    'MICROSOFT': ['MICROSOFT CORPORATION', 'MS'],
    'SAMSUNG': ['SAMSUNG ELECTRONICS'],
    'LG': ['LG ELECTRONICS', 'LG CORP'],
    'ACER': ['ACER INC', 'ACER COMPUTER'],
    'MSI': ['MICRO-STAR', 'MICRO STAR', 'MSI COMPUTER'],
};

/**
 * Mappa degli alias per le categorie - permette di riconoscere varianti della stessa categoria
 */
const CATEGORY_ALIASES: Record<string, string[]> = {
    'NOTEBOOK': ['LAPTOP', 'PORTATILE', 'PERSONAL COMPUTER', 'COMPUTER', 'PC PORTATILE', 'NOTEBOOKS'],
    'DESKTOP': ['PC DESKTOP', 'COMPUTER DESKTOP', 'WORKSTATION'],
    'MONITOR': ['DISPLAY', 'SCHERMO', 'MONITORS'],
    'STAMPANTE': ['PRINTER', 'STAMPANTI', 'PRINTERS'],
    'ACCESSORI': ['ACCESSORIES', 'ACCESSORY'],
};

/**
 * Servizio per gestire i filtri sui prodotti con logica AND/OR multi-livello
 * 
 * LOGICA IMPLEMENTATA:
 * - OR INTERNO (stesso gruppo): Marca: [Asus, Dell] → prodotti che sono Asus OR Dell
 * - AND ESTERNO (gruppi diversi): Marca: [Asus] + Categoria: [Notebook] → prodotti che sono Asus AND Notebook
 * 
 * Esempio: Marca: [Asus, Dell] + Categoria: [Notebook]
 * Risultato: (Asus OR Dell) AND Notebook → tutti i notebook Asus e tutti i notebook Dell
 */
export class ProductFilterService {

    /**
     * Valuta un prodotto contro criteri di filtro multi-selezione
     * Implementa logica: (OR interno per stesso gruppo) AND (tra gruppi diversi)
     */
    evaluateWithCriteria(
        criteria: FilterCriteria,
        productBrand: string | null,
        productCategory: string | null
    ): FilterResult {
        const normalizedBrand = productBrand?.trim().toUpperCase() || null;
        const normalizedCategory = productCategory?.trim() || null;

        const matchedRules: string[] = [];

        // Se non ci sono criteri, includi tutto
        if ((!criteria.brands || criteria.brands.length === 0) &&
            (!criteria.categories || criteria.categories.length === 0)) {
            return {
                shouldInclude: true,
                reason: 'Nessun filtro attivo'
            };
        }

        // Verifica match per BRAND (OR interno)
        let brandMatch = true;
        if (criteria.brands && criteria.brands.length > 0) {
            brandMatch = false;
            if (normalizedBrand) {
                for (const filterBrand of criteria.brands) {
                    if (this.brandMatches(normalizedBrand, filterBrand.toUpperCase())) {
                        brandMatch = true;
                        matchedRules.push(`Brand: ${filterBrand}`);
                        break;
                    }
                }
            }
        }

        // Verifica match per CATEGORY (OR interno)
        let categoryMatch = true;
        if (criteria.categories && criteria.categories.length > 0) {
            categoryMatch = false;
            if (normalizedCategory) {
                for (const filterCategory of criteria.categories) {
                    if (this.categoryMatches(normalizedCategory, filterCategory)) {
                        categoryMatch = true;
                        matchedRules.push(`Category: ${filterCategory}`);
                        break;
                    }
                }
            }
        }

        // AND tra gruppi: entrambi i gruppi devono matchare
        const shouldInclude = brandMatch && categoryMatch;

        return {
            shouldInclude,
            matchedRules: matchedRules.length > 0 ? matchedRules : undefined,
            reason: shouldInclude
                ? `Matched: ${matchedRules.join(', ')}`
                : `No match - Brand: ${brandMatch ? '✓' : '✗'}, Category: ${categoryMatch ? '✓' : '✗'}`
        };
    }

    /**
     * Valuta un prodotto contro le regole attive del database
     * Converte le regole (che ora usano FK) in FilterCriteria
     */
    async evaluateRules(
        rules: ProductFilterRule[],
        brand: string | null,
        category: string | null
    ): Promise<FilterResult> {
        if (rules.length === 0) {
            return {
                shouldInclude: true,
                reason: 'Nessuna regola di filtro attiva'
            };
        }

        // 1. Divide rules into Include and Exclude
        const includeRules = rules.filter(r => r.azione === 'include');
        const excludeRules = rules.filter(r => r.azione === 'exclude');

        // 2. Check Exclude rules first (Highest Priority)
        for (const rule of excludeRules) {
            const ruleBrand = (rule as any).marchio?.nome || null;
            const ruleCategory = (rule as any).categoria?.nome || null;

            const matchesBrand = ruleBrand ? (brand && this.brandMatches(brand, ruleBrand)) : true; // If no brand in rule, matches all brands
            const matchesCategory = ruleCategory ? (category && this.categoryMatches(category, ruleCategory)) : true; // If no cat in rule, matches all cats

            if (matchesBrand && matchesCategory) {
                return {
                    shouldInclude: false,
                    reason: `Escluso da regola: ${rule.nome}`
                };
            }
        }

        // 3. If no Include rules exist, include everything (that wasn't excluded)
        if (includeRules.length === 0) {
            return {
                shouldInclude: true,
                reason: 'Nessuna regola di inclusione, permesso di default'
            };
        }

        // 4. Check Include rules (OR Logic - Match ANY)
        const matchedIncludeRules: string[] = [];

        for (const rule of includeRules) {
            const ruleBrand = (rule as any).marchio?.nome || null;
            const ruleCategory = (rule as any).categoria?.nome || null;

            // Logica specifica: La regola matcha SE il prodotto soddisfa TUTTI i criteri definiti nella regola
            // Se la regola ha Brand=ASUS e Cat=Null -> Matcha tutto ASUS
            // Se la regola ha Brand=Null e Cat=RAM -> Matcha tutte le RAM
            // Se la regola ha Brand=ASUS e Cat=Notebook -> Matcha soltato ASUS Notebook

            const matchesBrand = ruleBrand ? (brand && this.brandMatches(brand, ruleBrand)) : true;
            const matchesCategory = ruleCategory ? (category && this.categoryMatches(category, ruleCategory)) : true;

            if (matchesBrand && matchesCategory) {
                matchedIncludeRules.push(rule.nome);
                // Basta un match per includere
                return {
                    shouldInclude: true,
                    matchedRules: [rule.nome],
                    reason: `Incluso da regola: ${rule.nome}`
                };
            }
        }

        // If we get here, no include rule matched
        return {
            shouldInclude: false,
            reason: 'Nessuna regola di inclusione soddisfatta'
        };
    }

    /**
     * Verifica se un prodotto deve essere incluso basandosi sulle regole attive
     */
    async shouldIncludeProduct(
        brand: string | null,
        category: string | null
    ): Promise<FilterResult> {
        const rules = await this.getActiveRules();
        return this.evaluateRules(rules, brand, category);
    }

    /**
     * Verifica se un brand matcha (case-insensitive, gestisce varianti e alias)
     * Usa word boundaries per evitare falsi positivi (es. ASUS non matcha ASUSTOR)
     * Supporta alias configurati in BRAND_ALIASES (es. ASUSTEK = ASUS)
     */
    private brandMatches(productBrand: string, ruleBrand: string): boolean {
        const normalized = productBrand.toUpperCase().trim();
        const ruleNormalized = ruleBrand.toUpperCase().trim();

        if (!normalized || !ruleNormalized) return false;

        // Match esatto
        if (normalized === ruleNormalized) {
            return true;
        }

        // NUOVO: Match tramite alias
        const ruleAliases = BRAND_ALIASES[ruleNormalized];
        if (ruleAliases && ruleAliases.includes(normalized)) {
            return true;
        }

        // NUOVO: Match inverso tramite alias
        for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
            if (aliases.includes(normalized) && canonical === ruleNormalized) {
                return true;
            }
            if (normalized === canonical && aliases.includes(ruleNormalized)) {
                return true;
            }
        }

        // Match con word boundaries
        const escapedRule = ruleNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`\\b${escapedRule}\\b`);

        if (wordBoundaryRegex.test(normalized)) {
            return true;
        }

        // Match inverso: SOLO se normalized è una parola valida (lunghezza > 1) per evitare match su stringhe vuote o singole lettere
        // \b\b matcha sempre.
        if (normalized.length > 1) {
            const escapedProduct = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const inverseRegex = new RegExp(`\\b${escapedProduct}\\b`);

            if (inverseRegex.test(ruleNormalized)) {
                return true;
            }
        }

        return false;
    }

    private categoryMatches(productCategory: string, ruleCategory: string): boolean {
        const normalized = productCategory.toUpperCase().trim();
        const ruleNormalized = ruleCategory.toUpperCase().trim();

        if (!normalized || !ruleNormalized) return false;

        // 1. Mappature Ad-Hoc Avanzate
        if (ruleNormalized === 'MOTHERBOARD') {
            const validTerms = ['MOTHERBOARD', 'MAINBOARD', 'SCHEDA MADRE', 'MOBO', 'PLACA BASE'];
            if (validTerms.some(term => normalized.includes(term))) {
                return true;
            }
        }

        if (['SCHEDA VIDEO', 'VIDEO CARD', 'GRAPHIC CARD', 'GPU', 'VGA'].includes(ruleNormalized)) {
            const validTerms = ['SCHEDA VIDEO', 'VIDEO CARD', 'GRAPHIC CARD', 'GPU', 'VGA', 'SCHEDE VIDEO'];
            if (validTerms.some(term => normalized.includes(term))) {
                return true;
            }
        }

        // Match esatto
        if (normalized === ruleNormalized) {
            return true;
        }

        // NUOVO: Match tramite alias
        const ruleAliases = CATEGORY_ALIASES[ruleNormalized];
        if (ruleAliases && ruleAliases.some(alias => alias.toUpperCase() === normalized)) {
            return true;
        }

        // NUOVO: Match inverso tramite alias
        for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
            const upperAliases = aliases.map(a => a.toUpperCase());
            if (upperAliases.includes(normalized) && canonical === ruleNormalized) {
                return true;
            }
            if (normalized === canonical && upperAliases.includes(ruleNormalized)) {
                return true;
            }
        }

        // Match parziale (contiene) - più permissivo
        // Check length to avoid matching "P" inside "PC" blindly unless intentional? 
        // Better: ensure normalized is not trivial.
        if (normalized.length > 1) {
            if (normalized.includes(ruleNormalized) || ruleNormalized.includes(normalized)) {
                return true;
            }
        }

        // Ultimo tentativo: token match
        if (normalized.length > 1) {
            const pTokens = normalized.split(/\s+/);
            const rTokens = ruleNormalized.split(/\s+/);
            const allRuleTokensInProduct = rTokens.every(t => pTokens.includes(t));
            if (allRuleTokensInProduct) return true;
        }

        return false;
    }

    /**
     * Filtra un array di prodotti basandosi sui criteri
     */
    async filterProductsWithCriteria(
        products: Array<{
            brand?: string | null;
            category?: string | null;
            [key: string]: any;
        }>,
        criteria: FilterCriteria
    ): Promise<Array<any>> {
        const filtered = [];

        for (const product of products) {
            const result = this.evaluateWithCriteria(
                criteria,
                product.brand || null,
                product.category || null
            );

            if (result.shouldInclude) {
                filtered.push({
                    ...product,
                    _filterInfo: {
                        matchedRules: result.matchedRules,
                        reason: result.reason
                    }
                });
            }
        }

        return filtered;
    }

    /**
     * Filtra un array di prodotti basandosi sulle regole (legacy)
     */
    async filterProducts(products: Array<{
        brand?: string | null;
        category?: string | null;
        [key: string]: any;
    }>): Promise<Array<any>> {
        const rules = await this.getActiveRules();
        const filtered = [];

        for (const product of products) {
            const result = await this.evaluateRules(
                rules,
                product.brand || null,
                product.category || null
            );

            if (result.shouldInclude) {
                filtered.push({
                    ...product,
                    _filterInfo: {
                        matchedRules: result.matchedRules,
                        reason: result.reason
                    }
                });
            }
        }

        return filtered;
    }

    /**
     * Calcola i conteggi dinamici (facet counts) per le opzioni di filtro
     * Mostra quanti prodotti risulterebbero per ogni opzione in combinazione con i filtri attivi
     */
    async getFacetCounts(
        products: Array<{
            brand?: string | null;
            category?: string | null;
            [key: string]: any;
        }>,
        currentCriteria: FilterCriteria
    ): Promise<{
        brands: FacetCount[];
        categories: FacetCount[];
    }> {
        // Helper: Convert to Title Case
        const toTitleCase = (str: string) => {
            return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        };

        // Helper: Resolve Canonical Category
        // Maps aliases (e.g. "Laptop") back to canonical (e.g. "Notebook")
        const getCanonicalCategory = (rawCat: string): string => {
            const upper = rawCat.trim().toUpperCase();

            // 1. Check if it IS a canonical key (direct match)
            if (Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, upper)) {
                return toTitleCase(upper);
            }

            // 2. Check if it is an ALIAS for a canonical key
            for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
                if (aliases.includes(upper)) {
                    return toTitleCase(canonical);
                }
                // Handle plurals/variations if basic inclusion check fails?
                // For now strict alias match + fuzzy check
                if (aliases.some(a => upper.includes(a) || a.includes(upper))) {
                    // Be careful with fuzzy matches like "PC" inside "PC ACCESSORI"
                    // If exact match of alias:
                    if (aliases.some(a => a === upper)) return toTitleCase(canonical);
                }
            }

            // 3. Fallback: just Title Case the original
            return toTitleCase(rawCat.trim());
        };

        // Helper: Resolve Canonical Brand
        // Maps aliases (e.g. "ASUSTEK") back to canonical (e.g. "ASUS")
        const normDisplay = (str: string) => {
            // If 3 chars or less, keep uppercase (HP, LG, MSI). Else TitleCase.
            return str.length <= 3 ? str.toUpperCase() : toTitleCase(str);
        };

        const getCanonicalBrandDisplay = (rawBrand: string): string => {
            const upper = rawBrand.trim().toUpperCase();

            // 1. Check Canonical Key DIRECTLY
            if (BRAND_ALIASES[upper]) return normDisplay(upper);

            // 2. Check Aliases (Iterate map)
            for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
                // Exact alias match (e.g. "ASUSTEK" == "ASUSTEK")
                if (aliases.includes(upper)) return normDisplay(canonical);

                // Partial matches:
                // Rule: If raw brand STARTS WITH canonical (e.g. "ASUS Computer") -> Canonize to ASUS
                if (upper.startsWith(canonical)) return normDisplay(canonical);

                // Rule: If raw brand IS CONTAINED in alias list (fuzzy) - Risky but needed?
                // Let's rely on exact alias or startsWith canonical for safety.
            }

            // Fallback
            return normDisplay(rawBrand);
        };

        // Mappe per aggregare i conteggi normalizzati
        const brandMap = new Map<string, number>();
        const categoryMap = new Map<string, number>();

        // 1. Calcola brands
        for (const p of products) {
            if (!p.brand) continue;

            const normalizedBrand = getCanonicalBrandDisplay(p.brand);

            // Check category match against current criteria
            const testCriteria: FilterCriteria = {
                brands: [normalizedBrand],
                categories: currentCriteria.categories
            };

            // Optimization: check only category compatibility
            let categoryMatch = true;
            if (currentCriteria.categories && currentCriteria.categories.length > 0) {
                const pCat = p.category ? getCanonicalCategory(p.category) : null;
                categoryMatch = false;
                if (pCat) {
                    for (const c of currentCriteria.categories) {
                        // Compare canonicals
                        if (pCat === c || this.categoryMatches(pCat, c)) {
                            categoryMatch = true;
                            break;
                        }
                    }
                }
            }

            if (categoryMatch) {
                brandMap.set(normalizedBrand, (brandMap.get(normalizedBrand) || 0) + 1);
            }
        }

        // 2. Calcola categorie
        for (const p of products) {
            if (!p.category) continue;

            // Use Canonical Normalization here!
            const normalizedCategory = getCanonicalCategory(p.category);

            // Check brand match
            let brandMatch = true;
            if (currentCriteria.brands && currentCriteria.brands.length > 0) {
                const pBrand = p.brand ? toTitleCase(p.brand.trim()) : null;
                brandMatch = false;
                if (pBrand) {
                    for (const b of currentCriteria.brands) {
                        if (this.brandMatches(pBrand, b)) {
                            brandMatch = true;
                            break;
                        }
                    }
                }
            }

            if (brandMatch) {
                categoryMap.set(normalizedCategory, (categoryMap.get(normalizedCategory) || 0) + 1);
            }
        }

        // Converti mappe in array
        const brands: FacetCount[] = Array.from(brandMap.entries()).map(([value, count]) => ({
            value,
            count,
            disabled: count === 0
        })).sort((a, b) => a.value.localeCompare(b.value));

        const categories: FacetCount[] = Array.from(categoryMap.entries()).map(([value, count]) => ({
            value,
            count,
            disabled: count === 0
        })).sort((a, b) => a.value.localeCompare(b.value));

        return { brands, categories };
    }

    /**
     * Ottiene statistiche sui prodotti filtrati
     */
    async getFilterStats(products: Array<{
        brand?: string | null;
        category?: string | null;
    }>): Promise<{
        total: number;
        included: number;
        excluded: number;
        byRule: Record<string, number>;
    }> {
        const rules = await this.getActiveRules();
        const stats = {
            total: products.length,
            included: 0,
            excluded: 0,
            byRule: {} as Record<string, number>
        };

        for (const product of products) {
            const result = await this.evaluateRules(
                rules,
                product.brand || null,
                product.category || null
            );

            if (result.shouldInclude) {
                stats.included++;
                if (result.matchedRules) {
                    for (const rule of result.matchedRules) {
                        stats.byRule[rule] = (stats.byRule[rule] || 0) + 1;
                    }
                }
            } else {
                stats.excluded++;
            }
        }

        return stats;
    }

    /**
     * Ottiene tutte le regole attive (include relazioni marchio/categoria)
     */
    async getActiveRules() {
        return await prisma.productFilterRule.findMany({
            where: { attiva: true },
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

    /**
     * Calcola il numero di prodotti in ListinoRaw che corrispondono a ciascuna regola
     */
    async getRuleMatchCounts(): Promise<Record<number, number>> {
        const rules = await prisma.productFilterRule.findMany({
            include: {
                marchio: true,
                categoria: true
            }
        });

        const rawProducts = await prisma.listinoRaw.findMany({
            select: {
                marca: true,
                categoriaFornitore: true
            }
        });

        const counts: Record<number, number> = {};
        // Initialize counts
        rules.forEach(r => counts[r.id] = 0);

        // Pre-process rules for faster access
        const excludeRules = rules.filter(r => r.azione === 'exclude').map(r => ({
            id: r.id,
            brand: r.marchio?.nome?.toUpperCase().trim() || null,
            category: r.categoria?.nome?.toUpperCase().trim() || null
        }));

        const includeRules = rules.filter(r => r.azione === 'include').map(r => ({
            id: r.id,
            brand: r.marchio?.nome?.toUpperCase().trim() || null,
            category: r.categoria?.nome?.toUpperCase().trim() || null
        }));

        // Optimized verification method that recycles normalized strings
        const checkMatch = (
            pNormBrand: string,
            pNormCat: string,
            ruleBrand: string | null,
            ruleCat: string | null
        ) => {
            // Brand Check
            let bMatch = true;
            if (ruleBrand) {
                if (pNormBrand === ruleBrand) {
                    bMatch = true;
                } else {
                    // Fallback to complex logic only if simple equality fails
                    // Only run complex check if simple check failed
                    // We need to pass original mixed-case or normalized? 
                    // The helper `brandMatches` does internal normalization. 
                    // For performance, we should ideally duplicate the logic here or optimze `brandMatches`
                    // But to ensure CONSISTENCY, we must call the class methods.
                    // However, calling class methods re-normalizes.
                    // Let's rely on class methods for correctness but pass unmodified strings if needed, 
                    // OR reuse the logic here.

                    // To be safe and fast:
                    // We already normalized P. Let's assume we can pass the normalized versions if we tweak logic,
                    // but `brandMatches` expects raw to normalize it again.
                    // Let's just call `this.brandMatches` BUT optimization:
                    // If we pass the ALREADY normalized string, `brandMatches` will just upper/trim it again (cheap).
                    // So we can pass pNormBrand.

                    bMatch = this.brandMatches(pNormBrand, ruleBrand);
                }
            }

            if (!bMatch) return false;

            // Category Check
            let cMatch = true;
            if (ruleCat) {
                if (pNormCat === ruleCat) {
                    cMatch = true;
                } else {
                    cMatch = this.categoryMatches(pNormCat, ruleCat);
                }
            }

            return cMatch;
        };

        // Iterate products ONCE
        for (const product of rawProducts) {
            const pBrandRaw = product.marca || '';
            const pCatRaw = product.categoriaFornitore || '';

            // Skip empty products early if that's desired behavior (consistent with previous fixes)
            if (!pBrandRaw && !pCatRaw) continue;

            // Pre-normalize once per product
            // Note: brandMatches/categoryMatches re-normalize, but doing it here allows simple equality checks first
            const pNormBrand = pBrandRaw.toUpperCase().trim();
            const pNormCat = pCatRaw.toUpperCase().trim();

            let isExcluded = false;

            // Check Exclude Rules
            for (const rule of excludeRules) {
                // Optimization: if simple match works, great. If not, call complex helpers.
                // We pass pNormBrand/pNormCat to helper methods. 
                // Since they are already upper/trimmed, the helper's upper/trim is redundant but harmless fast op.

                if (checkMatch(pNormBrand, pNormCat, rule.brand, rule.category)) {
                    counts[rule.id]++;
                    isExcluded = true;
                    // We DO NOT break here because we want to count stats for ALL exclude rules that apply
                    // (e.g. if a product is excluded by "Asus" and by "Notebook", both counts should go up)
                }
            }

            // If NOT excluded, check include rules
            if (!isExcluded) {
                for (const rule of includeRules) {
                    if (checkMatch(pNormBrand, pNormCat, rule.brand, rule.category)) {
                        counts[rule.id]++;
                    }
                }
            }
        }

        return counts;
    }

    /**
     * Crea una nuova regola di filtro
     */
    async createRule(data: {
        nome: string;
        marchioId?: number;
        categoriaId?: number;
        azione?: string;
        priorita?: number;
        attiva?: boolean;
        note?: string;
    }) {
        // Determina automaticamente il tipoFiltro in base ai campi forniti
        let tipoFiltro = 'custom';
        if (data.marchioId && data.categoriaId) {
            tipoFiltro = 'brand_category';
        } else if (data.marchioId) {
            tipoFiltro = 'brand';
        } else if (data.categoriaId) {
            tipoFiltro = 'category';
        }

        return await prisma.productFilterRule.create({
            data: {
                nome: data.nome,
                tipoFiltro: tipoFiltro,
                marchioId: data.marchioId || null,
                categoriaId: data.categoriaId || null,
                azione: data.azione || 'include',
                priorita: data.priorita || 1,
                attiva: data.attiva !== undefined ? data.attiva : true,
                note: data.note || null
            }
        });
    }

    /**
     * Aggiorna una regola esistente
     */
    async updateRule(id: number, data: Partial<{
        nome: string;
        marchioId: number;
        categoriaId: number;
        azione: string;
        priorita: number;
        attiva: boolean;
        note: string;
    }>) {
        // Se vengono aggiornati marchioId o categoriaId, ricalcola tipoFiltro
        if ('marchioId' in data || 'categoriaId' in data) {
            // Recupera la regola corrente per avere i valori attuali
            const currentRule = await prisma.productFilterRule.findUnique({
                where: { id }
            });

            if (!currentRule) {
                throw new Error('Regola non trovata');
            }

            // Usa i nuovi valori se forniti, altrimenti mantieni quelli esistenti
            const marchioId = 'marchioId' in data ? data.marchioId : currentRule.marchioId;
            const categoriaId = 'categoriaId' in data ? data.categoriaId : currentRule.categoriaId;

            // Determina il nuovo tipoFiltro
            let tipoFiltro = 'custom';
            if (marchioId && categoriaId) {
                tipoFiltro = 'brand_category';
            } else if (marchioId) {
                tipoFiltro = 'brand';
            } else if (categoriaId) {
                tipoFiltro = 'category';
            }

            // Aggiungi tipoFiltro ai dati da aggiornare
            (data as any).tipoFiltro = tipoFiltro;
        }

        return await prisma.productFilterRule.update({
            where: { id },
            data
        });
    }

    /**
     * Elimina una regola
     */
    async deleteRule(id: number) {
        return await prisma.productFilterRule.delete({
            where: { id }
        });
    }

    /**
     * Attiva/disattiva una regola
     */
    async toggleRule(id: number, attiva: boolean) {
        return await prisma.productFilterRule.update({
            where: { id },
            data: { attiva }
        });
    }

    /**
     * Carica un preset di regole
     */
    async loadPreset(presetId: number) {
        const preset = await prisma.filterPreset.findUnique({
            where: { id: presetId }
        });

        if (!preset) {
            throw new Error('Preset non trovato');
        }

        // Disattiva il preset corrente
        await prisma.filterPreset.updateMany({
            where: { attivo: true },
            data: { attivo: false }
        });

        // Attiva il nuovo preset
        await prisma.filterPreset.update({
            where: { id: presetId },
            data: { attivo: true }
        });

        return preset;
    }

    /**
     * Ottiene il preset attivo
     */
    async getActivePreset() {
        return await prisma.filterPreset.findFirst({
            where: { attivo: true }
        });
    }

    /**
     * Ottiene tutti i preset disponibili
     */
    async getAllPresets() {
        return await prisma.filterPreset.findMany({
            orderBy: { nome: 'asc' }
        });
    }

    /**
     * Metodo statico per filtrare prodotti con statistiche dettagliate
     */
    static async filterProducts(products: Array<{
        marca?: string | null;
        categoriaFornitore?: string | null;
        [key: string]: any;
    }>): Promise<{
        totalProducts: number;
        includedCount: number;
        excludedCount: number;
        includedProducts: any[];
        excludedProducts: any[];
    }> {
        const service = new ProductFilterService();
        const rules = await service.getActiveRules();
        const includedProducts: any[] = [];
        const excludedProducts: any[] = [];

        for (const product of products) {
            const result = await service.evaluateRules(
                rules,
                product.marca || null,
                product.categoriaFornitore || null
            );

            if (result.shouldInclude) {
                includedProducts.push(product);
            } else {
                excludedProducts.push(product);
            }
        }

        return {
            totalProducts: products.length,
            includedCount: includedProducts.length,
            excludedCount: excludedProducts.length,
            includedProducts,
            excludedProducts
        };
    }

    /**
     * Ottiene le opzioni disponibili per i filtri (marche e categorie univoche)
     * Estrae i brand dal campo marchio del MasterFile e, quando disponibile, dai dati Icecat
     * @param fornitoreId - Opzionale: filtra per fornitore specifico
     */
    async getAvailableOptions(fornitoreId?: number) {
        const brands = new Set<string>();
        const categories = new Set<string>();

        // Helper per validare se un valore è una marca valida
        const isValidBrand = (value: string): boolean => {
            if (!value || value.length > 50) return false;

            // Escludi valori numerici puri
            if (/^\d+$/.test(value.trim())) return false;

            // Escludi valori che contengono parole chiave di garanzia/descrizioni
            const invalidKeywords = [
                'garanzia', 'warranty', 'anno', 'year', 'mese', 'month',
                'supporto', 'support', 'assistenza', 'service',
                'consultare', 'vedere', 'see', 'visit', 'http', 'www',
                'limitata', 'limited', 'commerciale', 'commercial',
                'false', 'true', 'universale', 'universal', 'ogni', 'all'
            ];

            const lowerValue = value.toLowerCase();
            if (invalidKeywords.some(kw => lowerValue.includes(kw))) {
                return false;
            }

            return true;
        };

        // Costruisci where clause per filtrare per fornitore se specificato
        const whereClause: any = {};
        if (fornitoreId) {
            whereClause.fornitoreSelezionatoId = fornitoreId;
        }

        // Recupera prodotti con relazioni marchio e categoria
        const prodotti = await prisma.masterFile.findMany({
            where: whereClause,
            include: {
                marchio: true,
                categoria: true,
                datiIcecat: true,
                outputShopify: true,
                fornitoreSelezionato: true
            }
        });

        for (const p of prodotti) {
            // 1. Prima priorità: marca dal campo MasterFile.marchio (FK relation)
            if (p.marchio && isValidBrand(p.marchio.nome)) {
                brands.add(p.marchio.nome.trim());
            }

            // 2. Seconda priorità: marca da Icecat (se disponibile e diversa)
            if (p.datiIcecat?.specificheTecnicheJson) {
                try {
                    const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                    const icecatBrand = IcecatUtils.extractBrandFromFeatures(specs);

                    if (icecatBrand && isValidBrand(icecatBrand)) {
                        brands.add(icecatBrand.trim());
                    }
                } catch (e) {
                    // Skip parsing errors
                }
            }

            // Estrai categorie
            if (p.categoria) {
                categories.add(p.categoria.nome);
            } else if (p.outputShopify?.productType) {
                categories.add(p.outputShopify.productType);
            }
        }

        return {
            brands: Array.from(brands).sort(),
            categories: Array.from(categories).sort()
        };
    }
}

export const productFilterService = new ProductFilterService();
