// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * #13 — Rilevamento Duplicati nel Master File
 * Usa fuzzy matching (Levenshtein + normalizzazione) per trovare prodotti
 * probabilmente identici ma con EAN/nome leggermente diverso tra fornitori.
 */
export class DuplicateDetectionService {

    /**
     * Calcola la distanza di Levenshtein tra due stringhe (O(mn))
     */
    private static levenshtein(a: string, b: string): number {
        const m = a.length, n = b.length;
        const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
            Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
        );
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
        return dp[m][n];
    }

    /**
     * Calcola similarità [0,1] tra due stringhe
     */
    static similarity(a: string, b: string): number {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - this.levenshtein(a, b) / maxLen;
    }

    /**
     * Normalizza il nome prodotto per il confronto:
     * - minuscolo, rimuove punteggiatura, articoli, stopwords comuni
     * - ordina i token per stabilità
     */
    private static normalizeName(name: string): string {
        if (!name) return '';
        const stopwords = new Set(['the', 'di', 'da', 'il', 'la', 'lo', 'le', 'i', 'gli', 'con', 'per', 'in', 'a', 'e', 'o', 'un', 'una', 'uno']);
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 1 && !stopwords.has(t))
            .sort()
            .join(' ')
            .trim();
    }

    /**
     * Normalizza il partNumber: uppercase, rimuove trattini/spazi
     */
    private static normalizePN(pn: string | null): string {
        if (!pn) return '';
        return pn.toUpperCase().replace(/[-\s_]/g, '');
    }

    /**
     * Trova potenziali duplicati nel Master File di un utente.
     * Strategia:
     * 1. Raggruppa per marca (reduce search space da O(n²) a O(k²) per gruppo)
     * 2. Confronta nome normalizzato con Levenshtein
     * 3. Se sim > threshold → candidato duplicato
     * 4. Confronta anche partNumber (sim > 0.8 dopo normalizzazione)
     *
     * @param utenteId
     * @param threshold Soglia similarità nome [0-1], default 0.82
     * @param limit Numero max di gruppi duplicati da restituire
     */
    static async findDuplicates(
        utenteId: number,
        threshold: number = 0.82,
        limit: number = 50
    ): Promise<Array<{
        groupId: string;
        reason: string;
        score: number;
        products: any[];
    }>> {
        logger.info(`🔍 [Utente ${utenteId}] Avvio rilevamento duplicati (threshold: ${threshold})`);

        // Carica i prodotti (max 5000 per performance)
        const products = await prisma.masterFile.findMany({
            where: { utenteId },
            select: {
                id: true,
                eanGtin: true,
                partNumber: true,
                nomeProdotto: true,
                prezzoAcquistoMigliore: true,
                prezzoVenditaCalcolato: true,
                quantitaTotaleAggregata: true,
                marchioId: true,
                categoriaId: true,
                marchio: { select: { nome: true } },
                categoria: { select: { nome: true } },
                fornitoreSelezionato: { select: { nomeFornitore: true } }
            },
            take: 5000,
            orderBy: { id: 'asc' }
        });

        logger.info(`📦 [Utente ${utenteId}] ${products.length} prodotti caricati per analisi duplicati`);

        const groups: Map<string, { reason: string; score: number; products: any[] }> = new Map();
        const visited = new Set<string>(); // evita coppie doppie

        // Raggruppa per marchioId per ridurre comparazioni O(n²) → O(k²)
        const byBrand = new Map<number | null, typeof products>();
        for (const p of products) {
            const key = p.marchioId ?? -1;
            if (!byBrand.has(key)) byBrand.set(key, []);
            byBrand.get(key)!.push(p);
        }

        for (const [brandId, brandProducts] of byBrand) {
            if (brandProducts.length < 2) continue;

            for (let i = 0; i < brandProducts.length; i++) {
                for (let j = i + 1; j < brandProducts.length; j++) {
                    if (groups.size >= limit) break;

                    const a = brandProducts[i];
                    const b = brandProducts[j];
                    const pairKey = `${Math.min(a.id, b.id)}_${Math.max(a.id, b.id)}`;
                    if (visited.has(pairKey)) continue;
                    visited.add(pairKey);

                    let reason = '';
                    let score = 0;

                    // Check 1: PartNumber molto simile
                    const pnA = this.normalizePN(a.partNumber);
                    const pnB = this.normalizePN(b.partNumber);
                    if (pnA && pnB && pnA !== pnB) {
                        const pnSim = this.similarity(pnA, pnB);
                        if (pnSim >= 0.85) {
                            reason = `Part number simile (${(pnSim * 100).toFixed(0)}%)`;
                            score = pnSim;
                        }
                    }

                    // Check 2: Nome prodotto molto simile (se non già trovato via PN)
                    if (!reason) {
                        const nameA = this.normalizeName(a.nomeProdotto || '');
                        const nameB = this.normalizeName(b.nomeProdotto || '');
                        if (nameA.length > 6 && nameB.length > 6) {
                            const nameSim = this.similarity(nameA, nameB);
                            if (nameSim >= threshold) {
                                reason = `Nome prodotto simile (${(nameSim * 100).toFixed(0)}%)`;
                                score = nameSim;
                            }
                        }
                    }

                    // Check 3: Prezzo identico + stessa categoria (forte segnale)
                    if (!reason && a.categoriaId === b.categoriaId &&
                        a.prezzoAcquistoMigliore > 0 &&
                        Math.abs(a.prezzoAcquistoMigliore - b.prezzoAcquistoMigliore) < 0.5
                    ) {
                        const nameA = this.normalizeName(a.nomeProdotto || '');
                        const nameB = this.normalizeName(b.nomeProdotto || '');
                        const nameSim = this.similarity(nameA, nameB);
                        if (nameSim >= 0.70) {
                            reason = `Prezzo identico + nome simile (${(nameSim * 100).toFixed(0)}%)`;
                            score = Math.max(nameSim, 0.75);
                        }
                    }

                    if (reason) {
                        if (!groups.has(pairKey)) {
                            groups.set(pairKey, {
                                reason,
                                score: Math.round(score * 100) / 100,
                                products: [a, b]
                            });
                        }
                    }
                }
                if (groups.size >= limit) break;
            }
        }

        // Converti in array ordinato per score decrescente
        const result = Array.from(groups.entries())
            .map(([groupId, data]) => ({ groupId, ...data }))
            .sort((a, b) => b.score - a.score);

        logger.info(`✅ [Utente ${utenteId}] Trovati ${result.length} gruppi duplicati potenziali`);
        return result;
    }

    /**
     * Marca due prodotti come "confermati non duplicati" (ignora in futuro)
     * (stored in ConfigurazioneSistema come JSON set di pairKey)
     */
    static async ignorePair(utenteId: number, productIdA: number, productIdB: number): Promise<void> {
        const pairKey = `${Math.min(productIdA, productIdB)}_${Math.max(productIdA, productIdB)}`;
        const existing = await prisma.configurazioneSistema.findFirst({
            where: { utenteId, chiave: 'duplicate_ignored_pairs' }
        });
        const currentSet: string[] = existing?.valore ? JSON.parse(existing.valore) : [];
        if (!currentSet.includes(pairKey)) currentSet.push(pairKey);

        await prisma.configurazioneSistema.upsert({
            where: { utenteId_chiave: { utenteId, chiave: 'duplicate_ignored_pairs' } },
            update: { valore: JSON.stringify(currentSet) },
            create: { utenteId, chiave: 'duplicate_ignored_pairs', valore: JSON.stringify(currentSet), tipo: 'json' }
        });
    }
}
