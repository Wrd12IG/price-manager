import prisma from '../config/database';
import { ImportService } from '../services/ImportService';
import { logger } from '../utils/logger';

/**
 * Script per reimportare tutti i listini fornitori con marca e categoria
 */
async function reimportAllSuppliers() {
    try {
        console.log('=== REIMPORT LISTINI FORNITORI CON MARCA E CATEGORIA ===\n');

        // Recupera tutti i fornitori attivi
        const fornitori = await prisma.fornitore.findMany({
            where: { attivo: true },
            include: { mappatureCampi: true }
        });

        console.log(`Trovati ${fornitori.length} fornitori attivi:\n`);

        for (const fornitore of fornitori) {
            console.log(`\n[${fornitore.nomeFornitore}] Inizio importazione...`);
            console.log(`  Mappature configurate: ${fornitore.mappatureCampi.length}`);

            // Verifica se ha mappature per marca e categoria
            const hasMarca = fornitore.mappatureCampi.some(m => m.campoStandard === 'marca');
            const hasCategoria = fornitore.mappatureCampi.some(m => m.campoStandard === 'categoria');

            console.log(`  ✓ Marca: ${hasMarca ? '✅ Configurata' : '❌ Mancante'}`);
            console.log(`  ✓ Categoria: ${hasCategoria ? '✅ Configurata' : '❌ Mancante'}`);

            try {
                const result = await ImportService.importaListino(fornitore.id);

                console.log(`\n  Risultato importazione ${fornitore.nomeFornitore}:`);
                console.log(`    - Totale righe processate: ${result.total}`);
                console.log(`    - Righe inserite: ${result.inserted}`);
                console.log(`    - Righe scartate: ${result.errors}`);

                // Verifica quanti prodotti hanno marca e categoria
                const stats = await prisma.listinoRaw.groupBy({
                    by: ['fornitoreId'],
                    where: { fornitoreId: fornitore.id },
                    _count: {
                        _all: true,
                        marca: true,
                        categoriaFornitore: true
                    }
                });

                if (stats.length > 0) {
                    const s = stats[0];
                    console.log(`    - Prodotti con marca: ${s._count.marca}/${s._count._all}`);
                    console.log(`    - Prodotti con categoria: ${s._count.categoriaFornitore}/${s._count._all}`);
                }

                console.log(`  ✅ ${fornitore.nomeFornitore} completato!`);

            } catch (error: any) {
                console.error(`  ❌ Errore importazione ${fornitore.nomeFornitore}:`, error.message);
            }

            // Pausa tra fornitori
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('\n=== RIEPILOGO FINALE ===\n');

        // Statistiche finali
        const finalStats = await prisma.$queryRaw<Array<{
            fornitoreId: number;
            nomeFornitore: string;
            totale: number;
            con_marca: number;
            con_categoria: number;
        }>>`
            SELECT 
                lr.fornitoreId,
                f.nomeFornitore,
                COUNT(*) as totale,
                SUM(CASE WHEN lr.marca IS NOT NULL AND lr.marca != '' THEN 1 ELSE 0 END) as con_marca,
                SUM(CASE WHEN lr.categoriaFornitore IS NOT NULL AND lr.categoriaFornitore != '' THEN 1 ELSE 0 END) as con_categoria
            FROM listini_raw lr
            JOIN fornitori f ON lr.fornitoreId = f.id
            GROUP BY lr.fornitoreId, f.nomeFornitore
        `;

        for (const stat of finalStats) {
            console.log(`${stat.nomeFornitore}:`);
            console.log(`  - Totale prodotti: ${stat.totale}`);
            console.log(`  - Con marca: ${stat.con_marca} (${Math.round(stat.con_marca / stat.totale * 100)}%)`);
            console.log(`  - Con categoria: ${stat.con_categoria} (${Math.round(stat.con_categoria / stat.totale * 100)}%)`);
            console.log('');
        }

        // Verifica MasterFile
        const masterStats = await prisma.$queryRaw<Array<{
            totale: number;
            con_marca: number;
            con_categoria: number;
        }>>`
            SELECT 
                COUNT(*) as totale,
                SUM(CASE WHEN marca IS NOT NULL AND marca != '' THEN 1 ELSE 0 END) as con_marca,
                SUM(CASE WHEN categoriaEcommerce IS NOT NULL AND categoriaEcommerce != '' THEN 1 ELSE 0 END) as con_categoria
            FROM master_file
        `;

        if (masterStats.length > 0) {
            const ms = masterStats[0];
            console.log('Master File:');
            console.log(`  - Totale prodotti: ${ms.totale}`);
            console.log(`  - Con marca: ${ms.con_marca} (${Math.round(ms.con_marca / ms.totale * 100)}%)`);
            console.log(`  - Con categoria: ${ms.con_categoria} (${Math.round(ms.con_categoria / ms.totale * 100)}%)`);
        }

        console.log('\n✅ Reimport completato con successo!');

    } catch (error) {
        console.error('❌ Errore durante reimport:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Esegui lo script
reimportAllSuppliers().catch(console.error);
