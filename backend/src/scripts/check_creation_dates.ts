import prisma from '../config/database';

async function checkDates() {
    const prodotti = await prisma.outputShopify.findMany({
        where: { metafieldsJson: { not: null } },
        select: {
            id: true,
            title: true,
            metafieldsJson: true,
            createdAt: true,
            updatedAt: true
        },
        take: 30,
        orderBy: { createdAt: 'desc' }
    });

    console.log('📅 Analisi date creazione record:\n');

    let corte2Feb = 0;
    let lunghe2Feb = 0;
    let corte3Feb = 0;
    let lunghe3Feb = 0;

    for (const p of prodotti) {
        const meta = JSON.parse(p.metafieldsJson!);
        const table = meta['custom.tabella_specifiche'];
        const len = table ? table.length : 0;
        const status = len < 100 ? '❌ CORTA' : '✅ LUNGA';

        const dateStr = p.createdAt.toISOString().split('T')[0];
        const timeStr = p.createdAt.toISOString().split('T')[1].substring(0, 8);

        if (dateStr === '2026-02-02') {
            if (len < 100) corte2Feb++;
            else lunghe2Feb++;
        } else if (dateStr === '2026-02-03') {
            if (len < 100) corte3Feb++;
            else lunghe3Feb++;
        }

        console.log(`${status} (${len.toString().padStart(5)} char) - ${dateStr} ${timeStr} - ${p.title.substring(0, 45)}`);
    }

    console.log(`\n📊 Riepilogo:`);
    console.log(`   2 Feb: ${corte2Feb} corte, ${lunghe2Feb} lunghe`);
    console.log(`   3 Feb: ${corte3Feb} corte, ${lunghe3Feb} lunghe`);

    await prisma.$disconnect();
}

checkDates();
