import prisma from '../config/database';

async function simpleCount() {
    try {
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: { contains: 'Runner' } }
        });

        if (!runner) {
            console.log('Fornitore Runner non trovato');
            return;
        }

        const rawCount = await prisma.listinoRaw.count({
            where: { fornitoreId: runner.id }
        });

        const masterCount = await prisma.masterFile.count({
            where: { fornitoreSelezionatoId: runner.id }
        });

        console.log('--- RISULTATI ---');
        console.log(`Fornitore: ${runner.nomeFornitore} (ID: ${runner.id})`);
        console.log(`Prodotti importati (ListinoRaw): ${rawCount}`);
        console.log(`Prodotti consolidati (MasterFile): ${masterCount}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

simpleCount();
