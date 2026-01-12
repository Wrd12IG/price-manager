import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAsusConsolidation() {
    try {
        console.log('=== TESTING ASUS NOTEBOOK CONSOLIDATION ===\n');

        // 1. Get Asus products from ListinoRaw
        console.log('--- Step 1: Asus products in ListinoRaw ---');
        const asusRaw = await prisma.listinoRaw.findMany({
            where: {
                OR: [
                    { marca: { contains: 'ASUS' } },
                    { marca: { contains: 'NBAEDUB' } },
                    { marca: { contains: 'NBASB' } },
                    { marca: { contains: 'NBALB' } },
                    { descrizioneOriginale: { contains: 'ASUS' } }
                ]
            }
        });

        console.log(`Total Asus products in ListinoRaw: ${asusRaw.length}\n`);

        for (const p of asusRaw) {
            console.log(`SKU: ${p.skuFornitore}`);
            console.log(`  EAN: ${p.eanGtin || 'NULL'}`);
            console.log(`  Marca: "${p.marca}"`);
            console.log(`  Categoria: "${p.categoriaFornitore}"`);
            console.log(`  Prezzo: ${p.prezzoAcquisto}`);
            console.log(`  Quantità: ${p.quantitaDisponibile}`);
            console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 60)}...`);
            console.log('');
        }

        // 2. Check which ones have valid EAN
        const withEan = asusRaw.filter(p => p.eanGtin && p.eanGtin !== '');
        const withoutEan = asusRaw.filter(p => !p.eanGtin || p.eanGtin === '');

        console.log(`\n--- EAN Status ---`);
        console.log(`With EAN: ${withEan.length}`);
        console.log(`Without EAN: ${withoutEan.length}`);

        // 3. Check which ones would pass consolidation (have EAN and price > 0)
        const validForConsolidation = withEan.filter(p => p.prezzoAcquisto > 0);
        console.log(`\nValid for consolidation (EAN + price > 0): ${validForConsolidation.length}`);

        // 4. Check if they're in MasterFile
        console.log(`\n--- Step 2: Checking MasterFile ---`);
        const eans = validForConsolidation.map(p => p.eanGtin).filter(e => e);

        if (eans.length > 0) {
            const inMaster = await prisma.masterFile.findMany({
                where: {
                    eanGtin: { in: eans as string[] }
                }
            });

            console.log(`Products in MasterFile: ${inMaster.length}`);

            for (const m of inMaster) {
                console.log(`\n  EAN: ${m.eanGtin}`);
                console.log(`  Marca: "${m.marca}"`);
                console.log(`  Categoria: "${m.categoriaEcommerce}"`);
                console.log(`  Prezzo Vendita: ${m.prezzoVenditaCalcolato}`);
            }
        }

        // 5. Check filter rules
        console.log(`\n--- Step 3: Checking Filter Rules ---`);
        const rules = await prisma.productFilterRule.findMany({
            where: { attiva: true }
        });

        console.log(`Active filter rules: ${rules.length}`);
        for (const rule of rules) {
            console.log(`\n  Rule: ${rule.nome}`);
            console.log(`  Type: ${rule.tipoFiltro}`);
            console.log(`  Brand: "${rule.brand}"`);
            console.log(`  Category: "${rule.categoria}"`);
            console.log(`  Action: ${rule.azione}`);
        }

        // 6. Test filter matching
        console.log(`\n--- Step 4: Testing Filter Matching ---`);

        for (const p of validForConsolidation) {
            console.log(`\nProduct: ${p.skuFornitore}`);
            console.log(`  Marca: "${p.marca}"`);
            console.log(`  Categoria: "${p.categoriaFornitore}"`);

            // Test against each rule
            for (const rule of rules) {
                const brandMatch = rule.brand && p.marca ?
                    p.marca.toUpperCase().includes(rule.brand.toUpperCase()) ||
                    rule.brand.toUpperCase().includes(p.marca.toUpperCase()) : false;

                const categoryMatch = rule.categoria && p.categoriaFornitore ?
                    p.categoriaFornitore.toUpperCase().includes(rule.categoria.toUpperCase()) ||
                    rule.categoria.toUpperCase().includes(p.categoriaFornitore.toUpperCase()) : false;

                if (rule.tipoFiltro === 'brand_category') {
                    const matches = brandMatch && categoryMatch;
                    console.log(`  Rule "${rule.nome}": Brand=${brandMatch}, Category=${categoryMatch}, Match=${matches}`);
                } else if (rule.tipoFiltro === 'brand') {
                    console.log(`  Rule "${rule.nome}": Brand=${brandMatch}`);
                } else if (rule.tipoFiltro === 'category') {
                    console.log(`  Rule "${rule.nome}": Category=${categoryMatch}`);
                }
            }
        }

        // 7. Check category mappings
        console.log(`\n--- Step 5: Checking Category Mappings ---`);
        const categoryMappings = await prisma.mappaturaCategoria.findMany({
            where: {
                OR: [
                    { categoriaFornitore: { contains: 'NOTEBOOK' } },
                    { categoriaFornitore: { contains: 'BAREBONE' } }
                ]
            }
        });

        console.log(`Category mappings found: ${categoryMappings.length}`);
        for (const mapping of categoryMappings) {
            console.log(`\n  ${mapping.categoriaFornitore} -> ${mapping.categoriaEcommerce}`);
            console.log(`  Escludi: ${mapping.escludi}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAsusConsolidation();
