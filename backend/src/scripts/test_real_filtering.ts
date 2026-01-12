import prisma from '../config/database';
import { ProductFilterService } from '../services/ProductFilterService';

async function testRealFiltering() {
    console.log('=== TEST FILTRO REALE SU DATABASE ===\n');

    // Crea una regola temporanea per ASUS
    const service = new ProductFilterService();

    // Simula una regola per ASUS
    const testRule = {
        id: 999999,
        nome: 'Test ASUS',
        tipoFiltro: 'brand',
        brand: 'ASUS',
        categoria: null,
        azione: 'include',
        priorita: 1,
        attiva: true,
        note: null,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    // Trova prodotti ASUS, ASUSTEK e ASUSTOR nel database
    const products = await prisma.masterFile.findMany({
        where: {
            OR: [
                { marca: { contains: 'ASUS' } },
                { marca: { contains: 'ASUSTOR' } }
            ]
        },
        select: {
            id: true,
            eanGtin: true,
            marca: true,
            nomeProdotto: true
        },
        take: 20
    });

    console.log(`Trovati ${products.length} prodotti con ASUS/ASUSTOR nel nome\n`);

    // Testa il filtro su ciascun prodotto
    const results = {
        asus: [] as any[],
        asustek: [] as any[],
        asustor: [] as any[],
        other: [] as any[]
    };

    for (const p of products) {
        const result = await service.evaluateRules([testRule], p.marca, null);

        const brand = p.marca?.toUpperCase() || '';

        if (brand === 'ASUS') {
            results.asus.push({ ...p, shouldInclude: result.shouldInclude });
        } else if (brand === 'ASUSTEK') {
            results.asustek.push({ ...p, shouldInclude: result.shouldInclude });
        } else if (brand === 'ASUSTOR') {
            results.asustor.push({ ...p, shouldInclude: result.shouldInclude });
        } else {
            results.other.push({ ...p, shouldInclude: result.shouldInclude });
        }
    }

    console.log('=== RISULTATI PER BRAND ===\n');

    console.log(`ASUS (dovrebbero essere INCLUSI): ${results.asus.length}`);
    results.asus.forEach(p => {
        const status = p.shouldInclude ? '✅ INCLUSO' : '❌ ESCLUSO';
        console.log(`  ${status} - ${p.marca} - ${p.nomeProdotto?.substring(0, 50)}`);
    });

    console.log(`\nASUSTEK (dovrebbero essere ESCLUSI): ${results.asustek.length}`);
    results.asustek.forEach(p => {
        const status = p.shouldInclude ? '❌ INCLUSO (ERRORE!)' : '✅ ESCLUSO';
        console.log(`  ${status} - ${p.marca} - ${p.nomeProdotto?.substring(0, 50)}`);
    });

    console.log(`\nASUSTOR (dovrebbero essere ESCLUSI): ${results.asustor.length}`);
    results.asustor.forEach(p => {
        const status = p.shouldInclude ? '❌ INCLUSO (ERRORE!)' : '✅ ESCLUSO';
        console.log(`  ${status} - ${p.marca} - ${p.nomeProdotto?.substring(0, 50)}`);
    });

    if (results.other.length > 0) {
        console.log(`\nALTRI (con ASUS nel nome): ${results.other.length}`);
        results.other.forEach(p => {
            const status = p.shouldInclude ? '?' : '✅';
            console.log(`  ${status} - ${p.marca} - ${p.nomeProdotto?.substring(0, 50)}`);
        });
    }

    // Verifica errori
    const errors = [
        ...results.asustek.filter(p => p.shouldInclude),
        ...results.asustor.filter(p => p.shouldInclude)
    ];

    console.log('\n=== VERIFICA ===');
    if (errors.length === 0) {
        console.log('✅ TUTTO OK! Nessun falso positivo trovato.');
    } else {
        console.log(`❌ ERRORE! Trovati ${errors.length} falsi positivi!`);
    }

    await prisma.$disconnect();
    process.exit(errors.length > 0 ? 1 : 0);
}

testRealFiltering().catch(console.error);
