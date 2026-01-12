
import prisma from '../config/database';
import { MarkupService } from '../services/MarkupService';

async function applyAndVerify() {
    console.log('🚀 APPLICAZIONE FILTRI E VERIFICA\n');

    try {
        // 1. Applica Filtri e Markup
        console.log('1️⃣  Applicazione Filtri...');
        const result = await MarkupService.applicaRegolePrezzi();
        console.log(`   ✅ Processati: ${result.processed}`);
        console.log(`   ✅ Inclusi (Prezzo > 0): ${result.updated}`);
        console.log(`   🚫 Esclusi (Prezzo = 0): ${result.skippedByFilter}`);

        // 2. Analisi Prodotti Inclusi
        console.log('\n2️⃣  Analisi Prodotti Inclusi:');
        const includedProducts = await prisma.masterFile.findMany({
            where: { prezzoVenditaCalcolato: { gt: 0 } },
            select: { marca: true, categoriaEcommerce: true }
        });

        // Raggruppa per Categoria
        const catStats: Record<string, number> = {};
        const brandStats: Record<string, number> = {};

        includedProducts.forEach(p => {
            const cat = p.categoriaEcommerce || 'N/A';
            const brand = p.marca || 'N/A';
            catStats[cat] = (catStats[cat] || 0) + 1;
            brandStats[brand] = (brandStats[brand] || 0) + 1;
        });

        console.log('\n   Top 10 Categorie Incluse:');
        Object.entries(catStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .forEach(([k, v]) => console.log(`   - ${k}: ${v}`));

        console.log('\n   Top 10 Marche Incluse:');
        Object.entries(brandStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .forEach(([k, v]) => console.log(`   - ${k}: ${v}`));

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

applyAndVerify();
