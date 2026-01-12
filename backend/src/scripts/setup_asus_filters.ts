import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupAsusFilters() {
    try {
        console.log('=== SETTING UP ASUS FILTERS ===\n');

        // 1. Update existing filter rule
        console.log('--- Step 1: Updating filter rule ---');
        const existingRule = await prisma.productFilterRule.findFirst({
            where: {
                nome: 'Notebook Asus'
            }
        });

        if (existingRule) {
            await prisma.productFilterRule.update({
                where: { id: existingRule.id },
                data: {
                    brand: 'ASUS',  // Changed from ASUSTEK
                    categoria: null,  // Accept all categories for now
                    tipoFiltro: 'brand',  // Changed from brand_category
                    note: 'Include all ASUS products (updated to match corrected brand names)'
                }
            });
            console.log('✅ Updated existing rule to use "ASUS" brand');
        } else {
            // Create new rule
            await prisma.productFilterRule.create({
                data: {
                    nome: 'Notebook Asus',
                    tipoFiltro: 'brand',
                    brand: 'ASUS',
                    azione: 'include',
                    priorita: 1,
                    attiva: true,
                    note: 'Include all ASUS products'
                }
            });
            console.log('✅ Created new filter rule for ASUS');
        }

        // 2. Add ASUSTEK as well (for server products)
        const asustekRule = await prisma.productFilterRule.findFirst({
            where: {
                brand: 'ASUSTEK'
            }
        });

        if (!asustekRule) {
            await prisma.productFilterRule.create({
                data: {
                    nome: 'ASUSTEK Products',
                    tipoFiltro: 'brand',
                    brand: 'ASUSTEK',
                    azione: 'include',
                    priorita: 1,
                    attiva: true,
                    note: 'Include ASUSTEK server products'
                }
            });
            console.log('✅ Created filter rule for ASUSTEK');
        }

        // 3. Show all active rules
        console.log('\n--- Step 2: Active filter rules ---');
        const rules = await prisma.productFilterRule.findMany({
            where: { attiva: true },
            orderBy: { priorita: 'asc' }
        });

        for (const rule of rules) {
            console.log(`\n  ${rule.nome}`);
            console.log(`    Type: ${rule.tipoFiltro}`);
            console.log(`    Brand: ${rule.brand || 'any'}`);
            console.log(`    Category: ${rule.categoria || 'any'}`);
            console.log(`    Action: ${rule.azione}`);
            console.log(`    Priority: ${rule.priorita}`);
        }

        console.log('\n✅ Filter setup completed!');
        console.log('\nNow run consolidation to import the products.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupAsusFilters();
