
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMotherboardCount() {
    console.log('--- Checking ASUS Motherboard Count ---');

    const ruleName = 'ASUS MOTHERBOARD';
    // 1. Get the Rule ID
    const rule = await prisma.productFilterRule.findFirst({
        where: { nome: ruleName }
    });

    if (!rule) {
        console.log(`Rule "${ruleName}" not found.`);
        return;
    }

    console.log(`Rule found: ${rule.nome} (ID: ${rule.id})`);

    // 2. Get Exclude Rules
    const excludeRules = await prisma.productFilterRule.findMany({
        where: { azione: 'exclude' }
    });

    // 3. Get all raw products
    console.log('Fetching raw products...');
    const rawProducts = await prisma.listinoRaw.findMany({
        select: {
            id: true,
            marca: true,
            categoriaFornitore: true,
            descrizioneOriginale: true // Helpful for debugging
        }
    });

    console.log(`Total Raw Products: ${rawProducts.length}`);

    // Helpers
    const isMatch = (product: any, rule: any) => {
        const ruleBrand = rule.marchio?.nome?.toUpperCase() || null; // Assume eager loading or simple string matching logic here?
        // Wait, the previous script used a more complex inclusive/alias matching.
        // Let's implement a simplified robust matcher here for the script.

        const pBrand = (product.marca || '').toUpperCase().trim();
        const pCat = (product.categoriaFornitore || '').toUpperCase().trim();

        // Brand check
        // In the rule object from DB, we just have IDs if we don't include. 
        // But the user question implies we know the rule criteria: Brand=ASUS, Cat=motherboard

        // Let's HARDCODE the criteria based on the user prompt "Brand: ASUS, Category: motherboard"
        // to verify against the data directly, bypassing the rule object complexity for a moment.

        // Criteria for "ASUS MOTHERBOARD" rule
        const targetBrand = 'ASUS';
        const targetCat = 'MOTHERBOARD';

        // Check Brand (with alias logic approximation)
        const brandMatch = pBrand.includes(targetBrand) || pBrand === 'ASUSTEK';

        // Check Category (exact or contains)
        const catMatch = pCat === targetCat || pCat.includes(targetCat);

        return brandMatch && catMatch;
    };

    // 4. Filter Excluded First
    // We need to replicate exact logic to match the count.
    // But to simply "verify the number", let's count how many confirm to Brand=ASUS and Cat=Motherboard first.

    let matches = 0;

    // We need to emulate the exact matching logic from ProductFilterService to be precise.
    // Or we can just inspect the data distribution.

    console.log('\nScanning for Brand="ASUS" and Category="motherboard"...');

    // Simplified regex-based counts
    const candidates = rawProducts.filter(p => {
        const b = (p.marca || '').toUpperCase();
        const c = (p.categoriaFornitore || '').toUpperCase();

        const isAsus = b === 'ASUS' || b === 'ASUSTEK' || b.includes('ASUS');
        const isMobo = c === 'MOTHERBOARD' || c.includes('MAINBOARD') || c.includes('SCHEDA MADRE');

        return isAsus && isMobo;
    });

    console.log(`Found ${candidates.length} candidates using broad matching.`);

    // Let's show a sample of categories to see if "motherboard" covers them all
    const catSamples = new Set();
    candidates.forEach(c => catSamples.add(c.categoriaFornitore));
    console.log('Categories found:', Array.from(catSamples).slice(0, 10));

    await prisma.$disconnect();
}

checkMotherboardCount().catch(console.error);
