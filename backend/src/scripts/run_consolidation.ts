import { PrismaClient } from '@prisma/client';
import { MasterFileService } from '../services/MasterFileService';
import { MarkupService } from '../services/MarkupService';

const prisma = new PrismaClient();

async function runConsolidation() {
    try {
        console.log('=== RUNNING MASTER FILE CONSOLIDATION ===\n');

        // 1. Run consolidation
        console.log('--- Step 1: Consolidating MasterFile ---');
        const result = await MasterFileService.consolidaMasterFile();

        console.log(`\n✅ Consolidation completed!`);
        console.log(`  Processed: ${result.processed}`);
        console.log(`  Created: ${result.created}`);
        console.log(`  Updated: ${result.updated}`);

        // 2. Check Asus products in MasterFile
        console.log('\n--- Step 2: Checking ASUS products in MasterFile ---');
        const asusProducts = await prisma.masterFile.findMany({
            where: {
                OR: [
                    { marca: 'ASUS' },
                    { marca: 'ASUSTEK' }
                ]
            }
        });

        console.log(`\nASUS products in MasterFile: ${asusProducts.length}`);

        // Group by category
        const categoryMap = new Map<string, number>();
        for (const p of asusProducts) {
            const cat = p.categoriaEcommerce || 'Unknown';
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
        }

        console.log('\nBy category:');
        const sorted = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
        for (const [cat, count] of sorted) {
            console.log(`  ${cat}: ${count}`);
        }

        // Show some notebook examples
        const notebooks = asusProducts.filter(p =>
            p.nomeProdotto?.includes('NB ') ||
            p.categoriaEcommerce?.toLowerCase().includes('notebook')
        );

        console.log(`\n--- ASUS Notebooks: ${notebooks.length} ---`);
        for (const nb of notebooks.slice(0, 5)) {
            console.log(`\n  ${nb.nomeProdotto?.substring(0, 60)}...`);
            console.log(`  EAN: ${nb.eanGtin}`);
            console.log(`  Prezzo acquisto: €${nb.prezzoAcquistoMigliore}`);
            console.log(`  Prezzo vendita: €${nb.prezzoVenditaCalcolato}`);
        }

        // 3. Apply markup if prices are 0
        const withoutPrice = asusProducts.filter(p => p.prezzoVenditaCalcolato === 0);
        if (withoutPrice.length > 0) {
            console.log(`\n--- Step 3: Applying markup to ${withoutPrice.length} products ---`);
            const markupResult = await MarkupService.applicaRegolePrezzi();
            console.log(`✅ Markup applied: ${markupResult.updated} products updated`);

            // Re-check
            const updated = await prisma.masterFile.findMany({
                where: {
                    OR: [
                        { marca: 'ASUS' },
                        { marca: 'ASUSTEK' }
                    ],
                    prezzoVenditaCalcolato: { gt: 0 }
                }
            });

            console.log(`\nProducts with valid price: ${updated.length}/${asusProducts.length}`);
        }

        console.log('\n✅ All done! ASUS products are now in the MasterFile.');
        console.log('\nNext step: Run Shopify export preparation');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runConsolidation();
