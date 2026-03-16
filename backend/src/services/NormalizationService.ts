// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';

export class NormalizationService {

    /**
     * Ottiene ID del marchio normalizzato tramite alias o nome esatto
     */
    static async getNormalizedBrandId(name: string, utenteId: number | null = null): Promise<number | null> {
        if (!name) return null;
        const cleanName = name.trim();

        // 1. Controlla Alias (utente specifico o globale)
        const alias = await prisma.brandAlias.findFirst({
            where: {
                alias: cleanName,
                OR: [{ utenteId }, { utenteId: null }]
            }
        });

        if (alias) return alias.targetId;

        // 2. Controlla se esiste già come Marchio
        const brand = await prisma.marchio.findUnique({
            where: { nome: cleanName }
        });

        return brand?.id || null;
    }

    /**
     * Ottiene ID della categoria normalizzata
     */
    static async getNormalizedCategoryId(name: string, utenteId: number | null = null): Promise<number | null> {
        if (!name) return null;
        const cleanName = name.trim();

        const alias = await prisma.categoryAlias.findFirst({
            where: {
                alias: cleanName,
                OR: [{ utenteId }, { utenteId: null }]
            }
        });

        if (alias) return alias.targetId;

        const cat = await prisma.categoria.findUnique({
            where: { nome: cleanName }
        });

        return cat?.id || null;
    }

    /**
     * Identifica potenziali duplicati basandosi su nomi simili o suggerimenti Icecat identici
     */
    static async getPotentialDuplicates(type: 'brand' | 'category') {
        const items = type === 'brand'
            ? await prisma.marchio.findMany({ select: { id: true, nome: true } })
            : await prisma.categoria.findMany({ select: { id: true, nome: true } });

        // P4b: Algoritmo O(n) basato su hash per rilevare duplicati
        const normalizedGroups = new Map<string, any[]>();
        for (const item of items) {
            const normalizedName = item.nome.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedName.length < 3) continue; // Ignora nomi troppo corti
            if (!normalizedGroups.has(normalizedName)) normalizedGroups.set(normalizedName, []);
            normalizedGroups.get(normalizedName)!.push(item);
        }

        // Cerca anche sottostringhe significative (es. "MONITOR" dentro "MONITOR PC")
        const substringDuplicates: { item1: any; item2: any; reason: string }[] = [];
        const sortedItems = items.filter(i => i.nome.replace(/[^a-z0-9]/gi, '').length > 3)
            .sort((a, b) => a.nome.length - b.nome.length);

        for (let i = 0; i < sortedItems.length; i++) {
            const name1 = sortedItems[i].nome.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (let j = i + 1; j < sortedItems.length; j++) {
                const name2 = sortedItems[j].nome.toLowerCase().replace(/[^a-z0-9]/g, '');
                // Solo se il più corto è contenuto nel più lungo e hanno lunghezze simili
                if (name1 !== name2 && name2.includes(name1) && name1.length > 4) {
                    substringDuplicates.push({
                        item1: sortedItems[i],
                        item2: sortedItems[j],
                        reason: 'Nome simile'
                    });
                    if (substringDuplicates.length >= 50) break; // Limite per performance
                }
            }
            if (substringDuplicates.length >= 50) break;
        }

        // Duplicati Icecat (categorie con stesso suggerimento)
        let icecatDuplicates: { item1: any; item2: any; reason: string }[] = [];
        if (type === 'category') {
            const rawSuggestions = await prisma.$queryRaw`
                SELECT mf."categoriaId", di."categoriaIcecat", COUNT(*) as count
                FROM master_file mf
                JOIN dati_icecat di ON mf.id = di."masterFileId"
                WHERE mf."categoriaId" IS NOT NULL AND di."categoriaIcecat" IS NOT NULL
                GROUP BY mf."categoriaId", di."categoriaIcecat"
                ORDER BY count DESC
            `;

            const icecatSuggestions = new Map<number, string>();
            (rawSuggestions as any[]).forEach(row => {
                if (!icecatSuggestions.has(row.categoriaId)) {
                    icecatSuggestions.set(row.categoriaId, row.categoriaIcecat);
                }
            });

            // Raggruppa per suggerimento Icecat (O(n))
            const bySuggestion = new Map<string, any[]>();
            for (const item of items) {
                const sugg = icecatSuggestions.get(item.id);
                if (sugg) {
                    if (!bySuggestion.has(sugg)) bySuggestion.set(sugg, []);
                    bySuggestion.get(sugg)!.push(item);
                }
            }

            for (const [sugg, group] of bySuggestion) {
                if (group.length >= 2) {
                    for (let k = 0; k < group.length - 1; k++) {
                        icecatDuplicates.push({
                            item1: group[k],
                            item2: group[k + 1],
                            reason: `Entrambi mappati a "${sugg}" da Icecat`
                        });
                    }
                }
            }
        }

        // Combina i risultati: prima nomi identici, poi Icecat, poi sottostringhe
        const potential: { item1: any; item2: any; reason: string }[] = [];

        for (const [, group] of normalizedGroups) {
            if (group.length >= 2) {
                for (let k = 0; k < group.length - 1; k++) {
                    potential.push({
                        item1: group[k],
                        item2: group[k + 1],
                        reason: 'Nome simile'
                    });
                }
            }
        }

        potential.push(...icecatDuplicates);
        potential.push(...substringDuplicates);

        // Deduplicazione risultati (evita coppie ripetute)
        const seen = new Set<string>();
        return potential.filter(p => {
            const key = [p.item1.id, p.item2.id].sort().join('-');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Unisce due record: source viene eliminato e rimpiazzato da target ovunque
     */
    static async merge(type: 'brand' | 'category', sourceId: number, targetId: number, utenteId: number | null = null) {
        logger.info(`Merging ${type} ${sourceId} into ${targetId}`);

        if (sourceId === targetId) return;

        return await prisma.$transaction(async (tx) => {
            const source = type === 'brand'
                ? await tx.marchio.findUnique({ where: { id: sourceId } })
                : await tx.categoria.findUnique({ where: { id: sourceId } });

            if (!source) throw new Error(`${type} sorgente non trovato`);

            // 1. Aggiorna MasterFile
            if (type === 'brand') {
                await tx.masterFile.updateMany({
                    where: { marchioId: sourceId },
                    data: { marchioId: targetId }
                });

                // Crea/Aggiorna Alias
                await tx.brandAlias.upsert({
                    where: { alias: source.nome },
                    create: { alias: source.nome, targetId, utenteId },
                    update: { targetId }
                });

                // Elimina vecchio marchio
                await tx.marchio.delete({ where: { id: sourceId } });

            } else {
                await tx.masterFile.updateMany({
                    where: { categoriaId: sourceId },
                    data: { categoriaId: targetId }
                });

                // Crea/Aggiorna Alias
                await tx.categoryAlias.upsert({
                    where: { alias: source.nome },
                    create: { alias: source.nome, targetId, utenteId },
                    update: { targetId }
                });

                // Elimina vecchia categoria
                await tx.categoria.delete({ where: { id: sourceId } });
            }
        });
    }

    /**
     * Lista tutti i marchi/categorie con conteggi prodotti e suggerimenti Icecat
     */
    static async getStats(type: 'brand' | 'category') {
        let items: any[] = [];

        if (type === 'brand') {
            items = await prisma.marchio.findMany({
                include: {
                    _count: { select: { masterFiles: true } },
                    aliases: true
                },
                orderBy: { nome: 'asc' }
            });
        } else {
            items = await prisma.categoria.findMany({
                include: {
                    _count: { select: { masterFiles: true } },
                    aliases: true
                },
                orderBy: { nome: 'asc' }
            });

            // Se categorie, recuperiamo i suggerimenti Icecat aggregati
            const icecatSuggestions = await prisma.$queryRaw`
                SELECT mf."categoriaId", di."categoriaIcecat", COUNT(*) as count
                FROM master_file mf
                JOIN dati_icecat di ON mf.id = di."masterFileId"
                WHERE mf."categoriaId" IS NOT NULL AND di."categoriaIcecat" IS NOT NULL
                GROUP BY mf."categoriaId", di."categoriaIcecat"
                ORDER BY count DESC
            `;

            const suggestionMap: Map<number, string> = new Map();
            (icecatSuggestions as any[]).forEach(row => {
                if (!suggestionMap.has(row.categoriaId)) {
                    suggestionMap.set(row.categoriaId, row.categoriaIcecat);
                }
            });

            items = items.map(item => ({
                ...item,
                icecatSuggestion: suggestionMap.get(item.id) || null
            }));
        }

        return items;
    }

    /**
     * Ricerca veloce per merge manuale (P3: abbassato minimo da 2 a 1 carattere)
     */
    static async search(type: 'brand' | 'category', query: string) {
        const where = { nome: { contains: query, mode: 'insensitive' } };
        if (type === 'brand') {
            return await prisma.marchio.findMany({ where, take: 20 });
        } else {
            return await prisma.categoria.findMany({ where, take: 20 });
        }
    }

    /**
     * P3: Restituisce i top marchi/categorie per numero di prodotti (pre-caricamento dropdown)
     */
    static async getTopItems(type: 'brand' | 'category', limit: number = 20) {
        if (type === 'brand') {
            return await prisma.marchio.findMany({
                include: { _count: { select: { masterFiles: true } } },
                orderBy: { masterFiles: { _count: 'desc' } },
                take: limit
            });
        } else {
            return await prisma.categoria.findMany({
                include: { _count: { select: { masterFiles: true } } },
                orderBy: { masterFiles: { _count: 'desc' } },
                take: limit
            });
        }
    }

    /**
     * P2b: Rimuove marchi/categorie che non hanno prodotti associati
     */
    static async cleanOrphans(type: 'brand' | 'category'): Promise<number> {
        let deleted = 0;

        if (type === 'brand') {
            const orphans = await prisma.marchio.findMany({
                where: { masterFiles: { none: {} } },
                select: { id: true }
            });
            if (orphans.length > 0) {
                const draftIds = orphans.map(o => o.id);
                await prisma.brandAlias.deleteMany({
                    where: { targetId: { in: draftIds } }
                });
                await prisma.marchio.deleteMany({
                    where: { id: { in: draftIds } }
                });
                deleted = orphans.length;
            }
        } else {
            const orphans = await prisma.categoria.findMany({
                where: { masterFiles: { none: {} } },
                select: { id: true }
            });
            if (orphans.length > 0) {
                const draftIds = orphans.map(o => o.id);
                await prisma.categoryAlias.deleteMany({
                    where: { targetId: { in: draftIds } }
                });
                await prisma.regolaMarkup.deleteMany({
                    where: { categoriaId: { in: draftIds } }
                });
                await prisma.categoria.deleteMany({
                    where: { id: { in: draftIds } }
                });
                deleted = orphans.length;
            }
        }
        return deleted;
    }

    /**
     * P3b: Esegue l'unione automatica di tutte le categorie che hanno un suggerimento Icecat univoco
     */
    static async autoNormalizeAllCategories(utenteId: number | null = null): Promise<{ processed: number; merged: number }> {
        logger.info(`🚀 Avvio auto-normalizzazione categorie via Icecat (utente: ${utenteId || 'globale'})`);
        
        // 1. Recupera suggerimenti Icecat
        const icecatSuggestions = await prisma.$queryRaw`
            SELECT mf."categoriaId", di."categoriaIcecat", COUNT(*) as count
            FROM master_file mf
            JOIN dati_icecat di ON mf.id = di."masterFileId"
            WHERE mf."categoriaId" IS NOT NULL AND di."categoriaIcecat" IS NOT NULL
            GROUP BY mf."categoriaId", di."categoriaIcecat"
            ORDER BY count DESC
        `;

        const suggestionMap = new Map<number, string>();
        (icecatSuggestions as any[]).forEach(row => {
            if (!suggestionMap.has(row.categoriaId)) {
                suggestionMap.set(row.categoriaId, row.categoriaIcecat);
            }
        });

        // 2. Recupera tutte le categorie
        const categories = await prisma.categoria.findMany();
        const nameToId = new Map<string, number>();
        categories.forEach(c => nameToId.set(c.nome.toLowerCase().trim(), c.id));

        let merged = 0;
        let processed = 0;

        for (const cat of categories) {
            const suggestion = suggestionMap.get(cat.id);
            if (!suggestion) continue;

            processed++;
            const targetId = nameToId.get(suggestion.toLowerCase().trim());
            
            // Unisci solo se il target esiste ed è diverso dal sorgente
            if (targetId && targetId !== cat.id) {
                try {
                    await this.merge('category', cat.id, targetId, utenteId);
                    merged++;
                } catch (e) {
                    logger.error(`Errore auto-merge categoria ${cat.id} -> ${targetId}:`, e);
                }
            }
        }

        return { processed, merged };
    }
}
