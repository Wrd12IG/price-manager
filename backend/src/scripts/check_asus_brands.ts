import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAsusBrands() {
    try {
        console.log('--- Checking ALL brands in MasterFile ---');
        const allProducts = await prisma.masterFile.findMany({
            select: {
                marca: true,
                categoriaEcommerce: true,
                eanGtin: true,
                prezzoVenditaCalcolato: true
            }
        });

        console.log(`Total products in MasterFile: ${allProducts.length}`);

        // Group by brand
        const brandMap = new Map<string, number>();
        const categoryMap = new Map<string, number>();

        for (const p of allProducts) {
            if (p.marca) {
                brandMap.set(p.marca, (brandMap.get(p.marca) || 0) + 1);
            }
            if (p.categoriaEcommerce) {
                categoryMap.set(p.categoriaEcommerce, (categoryMap.get(p.categoriaEcommerce) || 0) + 1);
            }
        }

        console.log('\n--- Brands containing "Asus" (case insensitive) ---');
        const asusBrands = Array.from(brandMap.entries())
            .filter(([brand]) => brand.toLowerCase().includes('asus'))
            .sort((a, b) => b[1] - a[1]);

        if (asusBrands.length === 0) {
            console.log('❌ NO brands containing "Asus" found!');
        } else {
            asusBrands.forEach(([brand, count]) => {
                console.log(`  "${brand}": ${count} products`);
            });
        }

        console.log('\n--- All unique brands (first 50) ---');
        const sortedBrands = Array.from(brandMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50);

        sortedBrands.forEach(([brand, count]) => {
            console.log(`  "${brand}": ${count} products`);
        });

        console.log('\n--- Categories containing "Notebook" ---');
        const notebookCategories = Array.from(categoryMap.entries())
            .filter(([cat]) => cat.toLowerCase().includes('notebook'))
            .sort((a, b) => b[1] - a[1]);

        if (notebookCategories.length === 0) {
            console.log('❌ NO categories containing "Notebook" found!');
        } else {
            notebookCategories.forEach(([cat, count]) => {
                console.log(`  "${cat}": ${count} products`);
            });
        }

        console.log('\n--- Checking Icecat data for brand extraction ---');
        const productsWithIcecat = await prisma.masterFile.findMany({
            where: {
                datiIcecat: {
                    isNot: null
                }
            },
            take: 5,
            include: {
                datiIcecat: true
            }
        });

        console.log(`\nProducts with Icecat data: ${productsWithIcecat.length}`);
        for (const p of productsWithIcecat) {
            console.log(`\n  EAN: ${p.eanGtin}`);
            console.log(`  Marca (MasterFile): "${p.marca}"`);

            if (p.datiIcecat?.specificheTecnicheJson) {
                try {
                    const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                    const brandFeature = Array.isArray(specs) ? specs.find((f: any) =>
                        f.name?.toLowerCase() === 'brand' ||
                        f.name?.toLowerCase() === 'marca'
                    ) : null;
                    console.log(`  Brand from Icecat: ${brandFeature ? `"${brandFeature.value}"` : 'Not found'}`);
                } catch (e) {
                    console.log(`  Error parsing specs`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAsusBrands();
