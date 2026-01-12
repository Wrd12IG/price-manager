
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFilters() {
    console.log('--- Active Product Filter Rules ---');

    const rules = await prisma.productFilterRule.findMany({
        where: { attiva: true },
        orderBy: { priorita: 'asc' }
    });

    console.log(`Found ${rules.length} active filter rules:\n`);

    for (const rule of rules) {
        console.log(`Rule: ${rule.nome}`);
        console.log(`  Type: ${rule.tipoFiltro}`);
        console.log(`  Action: ${rule.azione}`);
        console.log(`  Brand: ${rule.brand || 'N/A'}`);
        console.log(`  Category: ${rule.categoria || 'N/A'}`);
        console.log(`  Priority: ${rule.priorita}`);
        console.log('');
    }

    await prisma.$disconnect();
}

checkFilters();
