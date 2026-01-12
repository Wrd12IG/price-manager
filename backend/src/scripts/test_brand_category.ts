import prisma from '../config/database';

/**
 * Test veloce per verificare dati marca e categoria
 */
async function testBrandCategoryData() {
    try {
        console.log('\n=== TEST MARCA E CATEGORIA ===\n');

        // 1. Statistiche Master File
        console.log('📊 MASTER FILE - Statistiche Generali:');
        const totalProducts = await prisma.masterFile.count();
        const withBrand = await prisma.masterFile.count({
            where: { marca: { not: '' } }
        });
        const withCategory = await prisma.masterFile.count({
            where: { categoriaEcommerce: { not: '' } }
        });

        console.log(`  - Totale prodotti: ${totalProducts}`);
        console.log(`  - Con marca: ${withBrand} (${Math.round(withBrand / totalProducts * 100)}%)`);
        console.log(`  - Con categoria: ${withCategory} (${Math.round(withCategory / totalProducts * 100)}%)`);

        // 2. Top 10 Marche
        console.log('\n📦 TOP 10 MARCHE:');
        const topBrands = await prisma.$queryRaw<Array<{ marca: string; count: number }>>`
            SELECT marca, COUNT(*) as count
            FROM master_file
            WHERE marca IS NOT NULL AND marca != ''
            GROUP BY marca
            ORDER BY count DESC
            LIMIT 10
        `;

        topBrands.forEach((b, i) => {
            console.log(`  ${i + 1}. ${b.marca}: ${b.count} prodotti`);
        });

        // 3. Top 10 Categorie
        console.log('\n🏷️  TOP 10 CATEGORIE:');
        const topCategories = await prisma.$queryRaw<Array<{ categoriaEcommerce: string; count: number }>>`
            SELECT categoriaEcommerce, COUNT(*) as count
            FROM master_file
            WHERE categoriaEcommerce IS NOT NULL AND categoriaEcommerce != ''
            GROUP BY categoriaEcommerce
            ORDER BY count DESC
            LIMIT 10
        `;

        topCategories.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.categoriaEcommerce}: ${c.count} prodotti`);
        });

        // 4. Esempi prodotti con marca e categoria
        console.log('\n📋 ESEMPI PRODOTTI (primi 10):');
        const sampleProducts = await prisma.masterFile.findMany({
            where: {
                AND: [
                    { marca: { not: '' } },
                    { categoriaEcommerce: { not: '' } }
                ]
            },
            select: {
                eanGtin: true,
                nomeProdotto: true,
                marca: true,
                categoriaEcommerce: true,
                prezzoVenditaCalcolato: true
            },
            take: 10,
            orderBy: { nomeProdotto: 'asc' }
        });

        sampleProducts.forEach((p, i) => {
            console.log(`\n  ${i + 1}. EAN: ${p.eanGtin}`);
            console.log(`     Nome: ${p.nomeProdotto?.substring(0, 60)}${(p.nomeProdotto?.length || 0) > 60 ? '...' : ''}`);
            console.log(`     Marca: ${p.marca}`);
            console.log(`     Categoria: ${p.categoriaEcommerce}`);
            console.log(`     Prezzo: €${p.prezzoVenditaCalcolato.toFixed(2)}`);
        });

        // 5. Test ProductFilterService
        console.log('\n\n🔍 TEST PRODUCTFILTERSERVICE:\n');

        const { ProductFilterService } = await import('../services/ProductFilterService');
        const service = new ProductFilterService();

        console.log('Caricamento opzioni filtro disponibili...');
        const options = await service.getAvailableOptions();

        console.log(`\n✅ Marche disponibili: ${options.brands.length}`);
        console.log(`   Prime 10: ${options.brands.slice(0, 10).join(', ')}`);

        console.log(`\n✅ Categorie disponibili: ${options.categories.length}`);
        console.log(`   Prime 10: ${options.categories.slice(0, 10).join(', ')}`);

        // 6. Test filtro specifico
        console.log('\n\n🧪 TEST FILTRO SPECIFICO (Marca: ASUS + Categoria: NOTEBOOK):\n');

        const asusNotebooks = await prisma.masterFile.findMany({
            where: {
                marca: { contains: 'ASUS' },
                categoriaEcommerce: { contains: 'NOTEBOOK' }
            },
            select: {
                eanGtin: true,
                nomeProdotto: true,
                marca: true,
                categoriaEcommerce: true,
                prezzoVenditaCalcolato: true
            },
            take: 5
        });

        if (asusNotebooks.length > 0) {
            console.log(`Trovati ${asusNotebooks.length} notebook ASUS (primi 5):\n`);
            asusNotebooks.forEach((p, i) => {
                console.log(`  ${i + 1}. ${p.nomeProdotto?.substring(0, 50)}`);
                console.log(`     Marca: ${p.marca} | Categoria: ${p.categoriaEcommerce}`);
                console.log(`     Prezzo: €${p.prezzoVenditaCalcolato.toFixed(2)}`);
            });
        } else {
            console.log('⚠️  Nessun notebook ASUS trovato. Prova con altri filtri.');
        }

        console.log('\n✅ Test completato con successo!\n');

    } catch (error) {
        console.error('❌ Errore durante test:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Esegui il test
testBrandCategoryData().catch(console.error);
