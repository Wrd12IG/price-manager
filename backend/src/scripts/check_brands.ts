
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMasterFileBrands() {
    console.log('--- Checking MasterFile Brands ---');

    const total = await prisma.masterFile.count();
    const withBrand = await prisma.masterFile.count({
        where: { marca: { not: null } }
    });

    console.log(`Total products: ${total}`);
    console.log(`Products with brand: ${withBrand}`);

    const brands = await prisma.masterFile.findMany({
        where: { marca: { not: null } },
        select: { marca: true },
        distinct: ['marca'],
        take: 20
    });

    console.log('Available brands:', brands.map(b => b.marca));

    // Check if we have Icecat data that could populate the brand
    const withIcecatButNoBrand = await prisma.masterFile.count({
        where: {
            marca: null,
            datiIcecat: { isNot: null }
        }
    });

    console.log(`Products with Icecat data but NO MasterFile brand: ${withIcecatButNoBrand}`);

    await prisma.$disconnect();
}

checkMasterFileBrands();
