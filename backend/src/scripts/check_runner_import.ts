import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRunnerImport() {
    try {
        console.log('=== CHECKING RUNNER IMPORT STATUS ===\n');

        // 1. Get Runner supplier info
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: 'Runner' }
        });

        if (!runner) {
            console.log('❌ Runner supplier not found!');
            return;
        }

        console.log('--- Runner Supplier Configuration ---');
        console.log(`ID: ${runner.id}`);
        console.log(`Nome: ${runner.nomeFornitore}`);
        console.log(`Attivo: ${runner.attivo}`);
        console.log(`Tipo accesso: ${runner.tipoAccesso}`);
        console.log(`Formato file: ${runner.formatoFile}`);
        console.log(`URL Listino: ${runner.urlListino || 'N/A'}`);
        console.log(`FTP Host: ${runner.ftpHost || 'N/A'}`);
        console.log(`FTP Directory: ${runner.ftpDirectory || 'N/A'}`);
        console.log(`Ultima sincronizzazione: ${runner.ultimaSincronizzazione}`);
        console.log(`Encoding: ${runner.encoding}`);
        console.log(`Separatore CSV: "${runner.separatoreCSV}"`);

        // 2. Count products in ListinoRaw
        const productCount = await prisma.listinoRaw.count({
            where: { fornitoreId: runner.id }
        });

        console.log(`\n--- Products in ListinoRaw ---`);
        console.log(`Total products: ${productCount}`);
        console.log(`Expected: ~12,000`);
        console.log(`Missing: ~${12000 - productCount}`);

        if (productCount < 12000) {
            console.log(`\n⚠️  WARNING: Only ${Math.round(productCount / 12000 * 100)}% of expected products imported!`);
        }

        // 3. Check import logs
        console.log(`\n--- Recent Import Logs ---`);
        const logs = await prisma.logElaborazione.findMany({
            where: {
                faseProcesso: 'import_listino',
                dettagliJson: {
                    contains: 'Runner'
                }
            },
            orderBy: { dataEsecuzione: 'desc' },
            take: 5
        });

        if (logs.length > 0) {
            for (const log of logs) {
                console.log(`\n  ${log.dataEsecuzione.toISOString()}`);
                console.log(`  Stato: ${log.stato}`);
                console.log(`  Prodotti processati: ${log.prodottiProcessati}`);
                console.log(`  Errori: ${log.prodottiErrore}`);
                console.log(`  Durata: ${log.durataSecondi}s`);
                if (log.dettagliJson) {
                    try {
                        const details = JSON.parse(log.dettagliJson);
                        console.log(`  Dettagli: ${JSON.stringify(details, null, 2)}`);
                    } catch (e) {
                        console.log(`  Dettagli: ${log.dettagliJson.substring(0, 100)}...`);
                    }
                }
            }
        } else {
            console.log('  No import logs found for Runner');
        }

        // 4. Check field mappings
        console.log(`\n--- Field Mappings ---`);
        const mappings = await prisma.mappaturaCampo.findMany({
            where: { fornitoreId: runner.id }
        });

        console.log(`Total mappings: ${mappings.length}`);
        if (mappings.length > 0) {
            console.log('\nMappings:');
            for (const m of mappings) {
                console.log(`  ${m.campoOriginale} -> ${m.campoStandard} (${m.tipoDato})`);
            }
        } else {
            console.log('⚠️  NO field mappings configured!');
        }

        // 5. Sample products
        console.log(`\n--- Sample Runner Products ---`);
        const samples = await prisma.listinoRaw.findMany({
            where: { fornitoreId: runner.id },
            take: 10,
            orderBy: { dataImportazione: 'desc' }
        });

        for (const p of samples) {
            console.log(`\n  SKU: ${p.skuFornitore}`);
            console.log(`  EAN: ${p.eanGtin || 'NULL'}`);
            console.log(`  Descrizione: ${p.descrizioneOriginale?.substring(0, 60)}...`);
            console.log(`  Marca: ${p.marca || 'NULL'}`);
            console.log(`  Categoria: ${p.categoriaFornitore || 'NULL'}`);
            console.log(`  Prezzo: €${p.prezzoAcquisto}`);
            console.log(`  Quantità: ${p.quantitaDisponibile}`);
            console.log(`  Importato: ${p.dataImportazione.toISOString()}`);
        }

        // 6. Check for duplicates or issues
        console.log(`\n--- Data Quality Check ---`);

        const withoutEan = await prisma.listinoRaw.count({
            where: {
                fornitoreId: runner.id,
                OR: [
                    { eanGtin: null },
                    { eanGtin: '' }
                ]
            }
        });

        const withoutPrice = await prisma.listinoRaw.count({
            where: {
                fornitoreId: runner.id,
                prezzoAcquisto: 0
            }
        });

        const withoutDescription = await prisma.listinoRaw.count({
            where: {
                fornitoreId: runner.id,
                OR: [
                    { descrizioneOriginale: null },
                    { descrizioneOriginale: '' }
                ]
            }
        });

        console.log(`Products without EAN: ${withoutEan} (${Math.round(withoutEan / productCount * 100)}%)`);
        console.log(`Products with price = 0: ${withoutPrice} (${Math.round(withoutPrice / productCount * 100)}%)`);
        console.log(`Products without description: ${withoutDescription} (${Math.round(withoutDescription / productCount * 100)}%)`);

        // 7. Recommendations
        console.log(`\n=== RECOMMENDATIONS ===\n`);

        if (productCount < 12000) {
            console.log('⚠️  IMPORT ISSUE DETECTED\n');
            console.log('Possible causes:');
            console.log('1. File parsing error - check field mappings');
            console.log('2. FTP connection issues - check credentials');
            console.log('3. File format changed - verify CSV structure');
            console.log('4. Import stopped early - check error logs');
            console.log('5. Wrong file being imported - verify FTP directory');

            console.log('\nNext steps:');
            console.log('1. Check the last import log for errors');
            console.log('2. Verify FTP connection and file access');
            console.log('3. Download the file manually and check format');
            console.log('4. Re-run import: curl -X POST http://localhost:3001/api/import/runner');
        } else {
            console.log('✅ Import looks healthy');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRunnerImport();
