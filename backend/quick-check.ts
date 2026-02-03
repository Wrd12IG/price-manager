import prisma from './src/config/database';

async function check() {
    const marchiCount = await prisma.marchio.count();
    const productsCount = await prisma.masterFile.count();
    console.log(`Marchi: ${marchiCount}`);
    console.log(`MasterFile: ${productsCount}`);
    process.exit(0);
}
check();
