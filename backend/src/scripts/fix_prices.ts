import { PrismaClient } from '@prisma/client';
import { MarkupService } from '../services/MarkupService';

const prisma = new PrismaClient();

async function fixPrices() {
    try {
        console.log('=== FIXING PRICES (REMOVING DEFAULT MARKUP) ===\n');

        // 1. Apply markup rules (which now default to 0% markup)
        console.log('--- Applying new pricing rules ---');
        const result = await MarkupService.applicaRegolePrezzi();

        console.log(`\n✅ Pricing update completed!`);
        console.log(`  Updated: ${result.updated}`);
        console.log(`  Errors: ${result.errors}`);

        // 2. Verify a few products
        console.log('\n--- Verification ---');
        const products = await prisma.masterFile.findMany({
            take: 5,
            orderBy: { prezzoAcquistoMigliore: 'desc' }
        });

        for (const p of products) {
            console.log(`Product: ${p.nomeProdotto?.substring(0, 40)}...`);
            console.log(`  Purchase Price: €${p.prezzoAcquistoMigliore}`);
            console.log(`  Selling Price:  €${p.prezzoVenditaCalcolato}`);
            const diff = (p.prezzoVenditaCalcolato || 0) - p.prezzoAcquistoMigliore;
            console.log(`  Difference:     €${diff.toFixed(2)}`);
            console.log('---');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixPrices();
