import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function searchProduct() {
    const searchEan = '4711387968345';

    try {
        console.log(`=== SEARCHING FOR PRODUCT ${searchEan} ===\n`);

        // 1. Search with variations
        console.log('--- Searching with EAN variations ---');

        // Try with leading zeros removed
        const eanWithoutLeadingZeros = searchEan.replace(/^0+/, '');

        // Try with leading zero added (UPC to EAN13)
        const eanWithLeadingZero = '0' + searchEan;

        const variations = [
            searchEan,
            eanWithoutLeadingZeros,
            eanWithLeadingZero,
            searchEan.substring(1), // Remove first digit
        ];

        console.log('Trying variations:');
        variations.forEach(v => console.log(`  - ${v}`));

        for (const ean of variations) {
            const found = await prisma.listinoRaw.findFirst({
                where: { eanGtin: ean },
                include: { fornitore: true }
            });

            if (found) {
                console.log(`\n✅ FOUND with EAN: ${ean}`);
                console.log(`  SKU: ${found.skuFornitore}`);
                console.log(`  Descrizione: ${found.descrizioneOriginale}`);
                console.log(`  Marca: ${found.marca}`);
                console.log(`  Fornitore: ${found.fornitore.nomeFornitore}`);
                console.log(`  Prezzo: €${found.prezzoAcquisto}`);
                return;
            }
        }

        // 2. Search in description
        console.log('\n--- Searching in descriptions ---');
        const byDescription = await prisma.listinoRaw.findMany({
            where: {
                descrizioneOriginale: {
                    contains: searchEan
                }
            },
            take: 5,
            include: { fornitore: true }
        });

        if (byDescription.length > 0) {
            console.log(`\n✅ Found ${byDescription.length} products with EAN in description:`);
            for (const p of byDescription) {
                console.log(`\n  SKU: ${p.skuFornitore}`);
                console.log(`  EAN: ${p.eanGtin || 'NULL'}`);
                console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 80)}...`);
                console.log(`  Fornitore: ${p.fornitore.nomeFornitore}`);
            }
        }

        // 3. Search similar EANs (same prefix)
        const prefix = searchEan.substring(0, 8);
        console.log(`\n--- Searching products with same prefix (${prefix}) ---`);

        const similarEans = await prisma.listinoRaw.findMany({
            where: {
                eanGtin: {
                    startsWith: prefix
                }
            },
            take: 10,
            include: { fornitore: true }
        });

        if (similarEans.length > 0) {
            console.log(`\n✅ Found ${similarEans.length} products with similar EAN:`);
            for (const p of similarEans) {
                console.log(`\n  EAN: ${p.eanGtin}`);
                console.log(`  SKU: ${p.skuFornitore}`);
                console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 60)}...`);
                console.log(`  Marca: ${p.marca}`);
            }
        } else {
            console.log('❌ No products found with similar EAN');
        }

        // 4. Show some ASUS products for reference
        console.log('\n--- Sample ASUS products in database ---');
        const asusProducts = await prisma.listinoRaw.findMany({
            where: {
                marca: 'ASUS'
            },
            take: 10,
            include: { fornitore: true }
        });

        if (asusProducts.length > 0) {
            console.log(`\nFound ${asusProducts.length} ASUS products (showing first 10):`);
            for (const p of asusProducts) {
                console.log(`\n  EAN: ${p.eanGtin || 'NULL'}`);
                console.log(`  SKU: ${p.skuFornitore}`);
                console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 60)}...`);
                console.log(`  Fornitore: ${p.fornitore.nomeFornitore}`);
                console.log(`  Prezzo: €${p.prezzoAcquisto}`);
            }
        }

        console.log('\n=== CONCLUSION ===');
        console.log(`\n❌ Product with EAN ${searchEan} NOT found in database`);
        console.log('\nPossible reasons:');
        console.log('1. Product not in supplier price lists');
        console.log('2. EAN is incorrect or has a typo');
        console.log('3. Supplier uses different EAN format');
        console.log('4. Product was filtered out during import');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

searchProduct();
