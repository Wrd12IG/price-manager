
import prisma from './src/config/database';
import { ProductFilterService } from './src/services/ProductFilterService';

async function main() {
    const service = new ProductFilterService();
    console.log("Calculating rule match counts...");
    const counts = await service.getRuleMatchCounts();

    // Fetch rules to print names
    const rules = await prisma.productFilterRule.findMany({
        include: { marchio: true, categoria: true }
    });

    console.log("--- Rules Match Counts ---");
    const asusRules = rules.filter(r => r.nome.toLowerCase().includes('asus') || (r.marchio && r.marchio.nome.toLowerCase().includes('asus')));

    let totalAsus = 0;

    for (const rule of asusRules) {
        const count = counts[rule.id] || 0;
        console.log(`[${rule.id}] ${rule.nome} (Brand: ${rule.marchio?.nome}, Cat: ${rule.categoria?.nome}): ${count} matches`);
        totalAsus += count;
    }

    console.log(`\nTotal matches across all ASUS rules: ${totalAsus}`);

    // Check raw counts for "ASUS" matches in alias logic
    console.log("\n--- Debugging Brand Matches ---");
    const rawProducts = await prisma.listinoRaw.findMany({
        select: { marca: true, categoriaFornitore: true }
    });

    let asusDirect = 0;
    let asustekDirect = 0;
    let matchedByService = 0;

    // We borrow the logic from service (private method access simulation)
    const asusService = new ProductFilterService();
    // @ts-ignore
    const brandMatches = asusService.brandMatches.bind(asusService);

    for (const p of rawProducts) {
        if (!p.marca) continue;
        const brand = p.marca.toUpperCase().trim();

        if (brand === 'ASUS') asusDirect++;
        if (brand === 'ASUSTEK') asustekDirect++;

        if (brandMatches(brand, 'ASUS')) {
            matchedByService++;
        }
    }

    console.log(`Direct 'ASUS': ${asusDirect}`);
    console.log(`Direct 'ASUSTEK': ${asustekDirect}`);
    console.log(`Matched by Service (Query='ASUS'): ${matchedByService}`);
}

main().catch(console.error);
