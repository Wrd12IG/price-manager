import prisma from '../config/database';
import { ImportService } from '../services/ImportService';

async function reimportAllSuppliers() {
    console.log("🔄 Reimportazione TUTTI i fornitori per includere tutti i prodotti...\n");

    const fornitori = await prisma.fornitore.findMany({ where: { attivo: true } });

    for (const fornitore of fornitori) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`📦 ${fornitore.nomeFornitore} (ID: ${fornitore.id})`);
        console.log("=".repeat(60));

        // Conta prodotti PRIMA
        const countBefore = await prisma.listinoRaw.count({ where: { fornitoreId: fornitore.id } });
        console.log(`📊 Prodotti PRIMA: ${countBefore}`);

        try {
            // Reimporta (senza consolidamento per velocità)
            console.log("⏳ Avvio reimportazione...");
            const result = await ImportService.importaListino(fornitore.id, false);

            // Conta prodotti DOPO
            const countAfter = await prisma.listinoRaw.count({ where: { fornitoreId: fornitore.id } });

            console.log(`✅ Importazione completata!`);
            console.log(`   Totale processati: ${result.total}`);
            console.log(`   Inseriti: ${result.inserted}`);
            console.log(`   Errori/Saltati: ${result.errors}`);
            console.log(`📊 Prodotti DOPO: ${countAfter}`);
            console.log(`   Differenza: ${countAfter - countBefore >= 0 ? '+' : ''}${countAfter - countBefore}`);

            // Statistiche prezzi
            const conPrezzo = await prisma.listinoRaw.count({
                where: { fornitoreId: fornitore.id, prezzoAcquisto: { gt: 0 } }
            });
            const senzaPrezzo = await prisma.listinoRaw.count({
                where: { fornitoreId: fornitore.id, prezzoAcquisto: 0 }
            });
            console.log(`📈 Con prezzo > 0: ${conPrezzo} | Senza prezzo: ${senzaPrezzo}`);

        } catch (err: any) {
            console.log(`❌ Errore: ${err.message}`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🏁 RIEPILOGO FINALE");
    console.log("=".repeat(60));

    for (const fornitore of fornitori) {
        const count = await prisma.listinoRaw.count({ where: { fornitoreId: fornitore.id } });
        console.log(`${fornitore.nomeFornitore}: ${count} prodotti`);
    }

    const totalProducts = await prisma.listinoRaw.count();
    console.log(`\n📊 TOTALE PRODOTTI: ${totalProducts}`);

    await prisma.$disconnect();
}

reimportAllSuppliers().catch(console.error);
