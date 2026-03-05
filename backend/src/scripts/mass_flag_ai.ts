import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Avvio ottimizzazione massiva database (isAiEnriched flag)...');

    // Trova tutti i prodotti che non sono stati ancora marcati ma potrebbero avere già i dati
    const allOutputs = await prisma.outputShopify.findMany({
        where: { isAiEnriched: false },
        select: { id: true, metafieldsJson: true }
    });

    let updatedCount = 0;

    for (const p of allOutputs) {
        let needsAi = true;
        if (p.metafieldsJson) {
            try {
                const meta = JSON.parse(p.metafieldsJson);
                const table = meta['custom.tabella_specifiche'] || '';
                if (table.length >= 100) needsAi = false; // specifiche trovate e valide
            } catch (e) { }
        }

        // Se non necessita di AI, segnamolo direttamente come "validato/arricchito" (o saltato) a true
        if (!needsAi) {
            await prisma.outputShopify.update({
                where: { id: p.id },
                data: { isAiEnriched: true }
            });
            updatedCount++;
        }
    }

    console.log(`✅ Ottimizzazione conclusa. ${updatedCount} prodotti esentati in massa dal ricalcolo AI.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
