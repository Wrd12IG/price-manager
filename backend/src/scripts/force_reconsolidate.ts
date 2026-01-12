
import { PrismaClient } from '@prisma/client';
import { MasterFileService } from '../services/MasterFileService';

const prisma = new PrismaClient();

async function reconsolidate() {
    console.log('--- Force Reconsolidation ---');

    // Check current state
    const masterCount = await prisma.masterFile.count();
    const masterWithBrand = await prisma.masterFile.count({ where: { marca: { not: null } } });

    console.log(`Before: ${masterWithBrand}/${masterCount} products with brand`);

    // Run consolidation
    console.log('\nRunning consolidation...');
    const result = await MasterFileService.consolidaMasterFile();

    console.log(`\nConsolidation result:`, result);

    // Check after
    const masterCountAfter = await prisma.masterFile.count();
    const masterWithBrandAfter = await prisma.masterFile.count({ where: { marca: { not: null } } });

    console.log(`\nAfter: ${masterWithBrandAfter}/${masterCountAfter} products with brand`);

    // Show sample brands
    const brands = await prisma.masterFile.findMany({
        where: { marca: { not: null } },
        select: { marca: true },
        distinct: ['marca'],
        take: 30
    });

    console.log('\nAvailable brands:', brands.map(b => b.marca).sort());

    await prisma.$disconnect();
}

reconsolidate();
