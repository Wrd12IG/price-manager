import prisma from '../config/database';
import { ImportService } from '../services/ImportService';

async function reimportRunner() {
    console.log("🔄 Reimportazione Runner per includere TUTTI i prodotti...\n");

    // Trova fornitore Runner
    const runner = await prisma.fornitore.findFirst({ where: { nomeFornitore: 'Runner' } });
    if (!runner) {
        console.log("❌ Fornitore Runner non trovato");
        await prisma.$disconnect();
        return;
    }

    console.log(`Fornitore: ${runner.nomeFornitore} (ID: ${runner.id})`);

    // Conta prodotti PRIMA
    const countBefore = await prisma.listinoRaw.count({ where: { fornitoreId: runner.id } });
    console.log(`\n📊 Prodotti Runner PRIMA: ${countBefore}`);

    // Reimporta (senza consolidamento per velocità)
    console.log("\n⏳ Avvio reimportazione...");
    const result = await ImportService.importaListino(runner.id, false);

    // Conta prodotti DOPO
    const countAfter = await prisma.listinoRaw.count({ where: { fornitoreId: runner.id } });
    console.log(`\n✅ Importazione completata!`);
    console.log(`   Totale processati: ${result.total}`);
    console.log(`   Inseriti: ${result.inserted}`);
    console.log(`   Errori/Saltati: ${result.errors}`);
    console.log(`\n📊 Prodotti Runner DOPO: ${countAfter}`);
    console.log(`   Differenza: +${countAfter - countBefore}`);

    // Mostra statistiche prezzi
    const conPrezzo = await prisma.listinoRaw.count({
        where: { fornitoreId: runner.id, prezzoAcquisto: { gt: 0 } }
    });
    const senzaPrezzo = await prisma.listinoRaw.count({
        where: { fornitoreId: runner.id, prezzoAcquisto: 0 }
    });
    console.log(`\n📈 Statistiche prezzi:`);
    console.log(`   Con prezzo > 0: ${conPrezzo}`);
    console.log(`   Senza prezzo (0): ${senzaPrezzo}`);

    await prisma.$disconnect();
}

reimportRunner().catch(console.error);
