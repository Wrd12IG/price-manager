
import { PrismaClient } from '@prisma/client';
import { ProductFilterService } from '../services/ProductFilterService';

const prisma = new PrismaClient();
const service = new ProductFilterService();

async function debugFilter() {
    console.log('--- Debugging Filter Logic ---');

    // 1. Get the problematic rule
    const rule = await prisma.productFilterRule.findFirst({
        where: { nome: 'ASUS MOTHERBOARD' },
        include: { marchio: true, categoria: true }
    });

    if (!rule) {
        console.log('Rule not found');
        return;
    }

    console.log('Rule:', JSON.stringify(rule, null, 2));

    const ruleBrand = rule.marchio?.nome || null;
    const ruleCategory = rule.categoria?.nome || null;

    console.log(`Rule Brand: "${ruleBrand}"`);
    console.log(`Rule Category: "${ruleCategory}"`);

    // 2. Fetch a few raw products that SHOULD match and logic that SHOULD NOT
    // (A) A real motherboard
    const realMobo = await prisma.listinoRaw.findFirst({
        where: {
            marca: { contains: 'ASUS' },
            categoriaFornitore: { contains: 'Motherboard' }
        }
    });

    // (B) A random ASUS notebook (should NOT match category)
    const randomLaptop = await prisma.listinoRaw.findFirst({
        where: {
            marca: { contains: 'ASUS' },
            categoriaFornitore: { contains: 'Notebook' }
        }
    });

    const checkProduct = (p: any, label: string) => {
        if (!p) {
            console.log(`${label}: Not found in DB`);
            return;
        }
        console.log(`\nTesting ${label}:`);
        console.log(`  Brand: "${p.marca}"`);
        console.log(`  Cat:   "${p.categoriaFornitore}"`);

        // Manually invoke private methods if we could, but we can't easily.
        // We will call evaluateWithCriteria or simpler check.

        // Replicating match logic from getRuleMatchCounts
        const b = p.marca || '';
        const c = p.categoriaFornitore || '';

        // @ts-ignore
        const bMatch = ruleBrand ? service.brandMatches(b, ruleBrand) : true;
        // @ts-ignore
        const cMatch = ruleCategory ? service.categoryMatches(c, ruleCategory) : true;

        console.log(`  -> Brand Match: ${bMatch}`);
        console.log(`  -> Cat Match:   ${cMatch} (Expected: ${label.includes('Mobo')})`);
        console.log(`  -> TOTAL:       ${bMatch && cMatch}`);
    };

    await checkProduct(realMobo, 'Real Motherboard');
    await checkProduct(randomLaptop, 'Random Laptop'); // This should fail Cat Match

    // 3. Count total ASUS products
    const totalAsus = await prisma.listinoRaw.count({
        where: { marca: { contains: 'ASUS' } }
    });
    console.log(`\nTotal ASUS products in Raw: ${totalAsus}`);

    await prisma.$disconnect();
}

debugFilter().catch(console.error);
