import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAsusBrands() {
    try {
        console.log('=== FIXING ASUS NOTEBOOK BRANDS ===\n');

        // 1. Find all products with wrong Asus brand codes
        const wrongBrands = ['NBAEDUB', 'NBASB', 'NBALB', 'NBASUS'];

        console.log('--- Step 1: Finding products with wrong brand codes ---');
        const productsToFix = await prisma.listinoRaw.findMany({
            where: {
                marca: { in: wrongBrands }
            }
        });

        console.log(`Found ${productsToFix.length} products with wrong brand codes\n`);

        // 2. Update them to ASUS
        console.log('--- Step 2: Updating brands to ASUS ---');
        const updateResult = await prisma.listinoRaw.updateMany({
            where: {
                marca: { in: wrongBrands }
            },
            data: {
                marca: 'ASUS'
            }
        });

        console.log(`Updated ${updateResult.count} products\n`);

        // 3. Check for products with null category but ASUS in description
        console.log('--- Step 3: Checking products with null marca but ASUS in description ---');
        const nullBrandAsus = await prisma.listinoRaw.findMany({
            where: {
                OR: [
                    { marca: 'null' },
                    { marca: null }
                ],
                descrizioneOriginale: { contains: 'ASUS' }
            },
            take: 20
        });

        console.log(`Found ${nullBrandAsus.length} products with null brand but ASUS in description`);

        if (nullBrandAsus.length > 0) {
            console.log('\nExamples:');
            for (const p of nullBrandAsus.slice(0, 5)) {
                console.log(`  SKU: ${p.skuFornitore}`);
                console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 60)}...`);
                console.log('');
            }

            // Update these too
            const nullBrandUpdate = await prisma.listinoRaw.updateMany({
                where: {
                    OR: [
                        { marca: 'null' },
                        { marca: null }
                    ],
                    descrizioneOriginale: { contains: 'ASUS' }
                },
                data: {
                    marca: 'ASUS'
                }
            });

            console.log(`Updated ${nullBrandUpdate.count} products with null brand\n`);
        }

        // 4. Check final count
        console.log('--- Step 4: Final verification ---');
        const asusCount = await prisma.listinoRaw.count({
            where: {
                OR: [
                    { marca: 'ASUS' },
                    { marca: 'ASUSTEK' }
                ]
            }
        });

        console.log(`Total ASUS/ASUSTEK products: ${asusCount}`);

        // 5. Check notebooks specifically
        const asusNotebooks = await prisma.listinoRaw.findMany({
            where: {
                OR: [
                    { marca: 'ASUS' },
                    { marca: 'ASUSTEK' }
                ],
                descrizioneOriginale: { contains: 'NB ' }
            }
        });

        console.log(`ASUS Notebooks: ${asusNotebooks.length}`);

        // Check how many have valid price
        const withPrice = asusNotebooks.filter(p => p.prezzoAcquisto > 0);
        const withoutPrice = asusNotebooks.filter(p => p.prezzoAcquisto === 0);

        console.log(`  With price > 0: ${withPrice.length}`);
        console.log(`  With price = 0: ${withoutPrice.length}`);

        if (withoutPrice.length > 0) {
            console.log('\n⚠️  WARNING: Many notebooks have price = 0');
            console.log('This is likely a problem with the supplier file import.');
            console.log('Check the file parsing configuration for the supplier.');
        }

        console.log('\n✅ Brand correction completed!');
        console.log('\nNext steps:');
        console.log('1. Fix the price import issue (check supplier file format)');
        console.log('2. Run consolidation: MasterFileService.consolidaMasterFile()');
        console.log('3. Run price calculation: MarkupService.applyMarkup()');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixAsusBrands();
