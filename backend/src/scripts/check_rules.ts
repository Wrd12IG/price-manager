
import prisma from '../config/database';

async function check() {
    const count = await prisma.productFilterRule.count({ where: { attiva: true } });
    console.log(`Regole attive: ${count}`);

    const rules = await prisma.productFilterRule.findMany({
        where: { attiva: true },
        take: 10
    });
    rules.forEach(r => console.log(`- ${r.nome} (${r.tipoFiltro}): ${r.brand} / ${r.categoria}`));
}
check();
