
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMasterFileStats() {
    try {
        // 1. Totale EAN unici nei listini raw (Potenziale teorico)
        const uniqueEansRaw = await prisma.listinoRaw.groupBy({
            by: ['eanGtin'],
            _count: true
        });
        console.log(`\n--- STATISTICHE RAW ---`);
        console.log(`Totale EAN unici dai fornitori: ${uniqueEansRaw.length}`);

        // 2. Totale prodotti nel Master File (Attuali)
        const masterFileCount = await prisma.masterFile.count();
        console.log(`\n--- STATISTICHE MASTER FILE ---`);
        console.log(`Prodotti nel Master File (Consolidati e Filtrati): ${masterFileCount}`);

        // 3. Verifica Filtri Attivi (che potrebbero aver ridotto il numero)
        // Controlliamo le regole di filtro prodotto
        const activeFilters = await prisma.productFilterRule.findMany({
            where: { attiva: true }
        });

        console.log(`\n--- FILTRI ATTIVI ---`);
        if (activeFilters.length === 0) {
            console.log("Nessun filtro prodotto attivo.");
        } else {
            console.table(activeFilters.map(f => ({
                tipo: f.tipoFiltro,
                brand: f.brand,
                azione: f.azione
            })));
        }

        // 4. Esempio di prodotti nel Master File
        if (masterFileCount > 0) {
            const sample = await prisma.masterFile.findMany({
                take: 3,
                select: {
                    eanGtin: true,
                    marca: true,
                    prezzoAcquistoMigliore: true,
                    quantitaTotaleAggregata: true,
                    fornitoreSelezionato: { select: { nomeFornitore: true } }
                }
            });
            console.log(`\n--- ESEMPIO PRODOTTI MASTER FILE ---`);
            console.table(sample);
        }

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMasterFileStats();
