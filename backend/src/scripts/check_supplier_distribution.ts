
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDistribution() {
    console.log('--- Checking Supplier Distribution ---\n');

    // 1. Check ListinoRaw (Source)
    console.log('--- ListinoRaw (Source Data) ---');
    const rawCounts = await prisma.listinoRaw.groupBy({
        by: ['fornitoreId'],
        _count: {
            id: true
        }
    });

    // Get supplier names
    const suppliers = await prisma.fornitore.findMany();
    const supplierMap = new Map(suppliers.map(s => [s.id, s.nomeFornitore]));

    let totalRaw = 0;
    for (const count of rawCounts) {
        const name = supplierMap.get(count.fornitoreId) || `ID ${count.fornitoreId}`;
        console.log(`${name}: ${count._count.id} products`);
        totalRaw += count._count.id;
    }
    console.log(`TOTAL RAW: ${totalRaw}\n`);

    // 2. Check MasterFile (Consolidated Data)
    console.log('--- MasterFile (Filtered & Consolidated) ---');
    const masterCounts = await prisma.masterFile.groupBy({
        by: ['fornitoreSelezionatoId'],
        _count: {
            id: true
        }
    });

    let totalMaster = 0;
    for (const count of masterCounts) {
        if (!count.fornitoreSelezionatoId) continue;
        const name = supplierMap.get(count.fornitoreSelezionatoId) || `ID ${count.fornitoreSelezionatoId}`;
        console.log(`${name}: ${count._count.id} products`);
        totalMaster += count._count.id;
    }
    console.log(`TOTAL MASTER: ${totalMaster}\n`);

    // 3. Check Active Filters
    console.log('--- Active Filters ---');
    const rules = await prisma.productFilterRule.findMany({
        where: { attiva: true },
        include: { marchio: true, categoria: true },
        orderBy: { priorita: 'asc' }
    });

    if (rules.length === 0) {
        console.log('No active filters.');
    } else {
        for (const rule of rules) {
            console.log(`- [${rule.azione.toUpperCase()}] ${rule.nome}`);
            if (rule.marchio) console.log(`  Brand: ${rule.marchio.nome}`);
            if (rule.categoria) console.log(`  Category: ${rule.categoria.nome}`);
        }
    }

    await prisma.$disconnect();
}

checkDistribution().catch(e => {
    console.error(e);
    process.exit(1);
});
