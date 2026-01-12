import prisma from '../config/database';
import { IcecatUtils } from '../utils/IcecatUtils';

async function debugBrands() {
    console.log('=== DEBUG BRANDS ===\n');

    // 1. Conta prodotti
    const totalProducts = await prisma.masterFile.count();
    const withIcecat = await prisma.masterFile.count({
        where: { datiIcecat: { isNot: null } }
    });

    console.log(`Prodotti totali: ${totalProducts}`);
    console.log(`Prodotti con Icecat: ${withIcecat}\n`);

    // 2. Prendi un piccolo campione
    const samples = await prisma.masterFile.findMany({
        include: { datiIcecat: true },
        where: { datiIcecat: { isNot: null } },
        take: 5
    });

    console.log('=== CAMPIONE DI 5 PRODOTTI ===\n');
    const brandsFound = new Set<string>();

    for (const p of samples) {
        console.log(`ID: ${p.id}, EAN: ${p.eanGtin}`);
        console.log(`Marca MasterFile: ${p.marca || 'N/A'}`);

        if (p.datiIcecat?.specificheTecnicheJson) {
            try {
                const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                const brand = IcecatUtils.extractBrandFromFeatures(specs);
                console.log(`Brand da Icecat: ${brand || 'NON TROVATO'}`);

                if (brand) {
                    brandsFound.add(brand);
                }

                // Mostra le prime 3 features per debug
                console.log('Prime 3 features:');
                specs.slice(0, 3).forEach((f: any) => {
                    console.log(`  - ${f.name}: ${f.value}`);
                });
            } catch (e) {
                console.log('Errore parsing JSON');
            }
        }
        console.log('---\n');
    }

    console.log('=== BRANDS TROVATI ===');
    console.log(Array.from(brandsFound));

    // 3. Conta quanti prodotti hanno un brand estraibile
    let productsWithBrand = 0;
    const allBrands = new Set<string>();

    const allProducts = await prisma.masterFile.findMany({
        include: { datiIcecat: true },
        where: { datiIcecat: { isNot: null } }
    });

    console.log(`\n=== ANALISI COMPLETA DI ${allProducts.length} PRODOTTI ===\n`);

    for (const p of allProducts) {
        if (p.datiIcecat?.specificheTecnicheJson) {
            try {
                const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                const brand = IcecatUtils.extractBrandFromFeatures(specs);

                if (brand) {
                    productsWithBrand++;
                    allBrands.add(brand);
                }
            } catch (e) {
                // Skip
            }
        }
    }

    console.log(`Prodotti con brand estraibile: ${productsWithBrand}/${allProducts.length}`);
    console.log(`Numero di brand unici: ${allBrands.size}`);
    console.log('\nBrands trovati:');
    Array.from(allBrands).sort().forEach(b => console.log(`  - ${b}`));

    await prisma.$disconnect();
}

debugBrands().catch(console.error);
