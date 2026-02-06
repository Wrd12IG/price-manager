/**
 * Script ottimizzato per rigenerare le tabelle specifiche mancanti SOLO per SANTE (utente 2)
 * Update: filtra per utente e procede per batch
 */
import prisma from './src/config/database';

const UTENTE_SANTE_ID = 2;

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function generateSpecsTable(specs: any): string | null {
    if (!specs || (Array.isArray(specs) && specs.length === 0)) {
        return null;
    }

    const specsList = Array.isArray(specs)
        ? specs
        : Object.entries(specs).map(([name, value]) => ({ name, value }));

    if (specsList.length === 0) {
        return null;
    }

    let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
    let rowsAdded = 0;

    for (const spec of specsList) {
        const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
        const value = spec.value || spec.PresentationValue || '';

        if (!name || !value) {
            continue;
        }

        rowsAdded++;
        tableHtml += `<tr>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${escapeHtml(name)}</strong></td>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${escapeHtml(String(value))}</td>`;
        tableHtml += `</tr>`;
    }

    tableHtml += '</table>';

    return rowsAdded > 0 ? tableHtml : null;
}

async function fixMissingTablesForSante() {
    console.log('🔧 FIX TABELLE SPECIFICHE - Account SANTE (ID 2)\n');
    console.log('='.repeat(60));

    // Prima conta quanti prodotti ci sono
    const totalCount = await prisma.outputShopify.count({
        where: {
            utenteId: UTENTE_SANTE_ID,
            masterFile: {
                datiIcecat: {
                    specificheTecnicheJson: { not: null }
                }
            }
        }
    });

    console.log(`📊 Prodotti SANTE con specifiche ICECAT: ${totalCount}\n`);

    // Procedi in batch
    const BATCH_SIZE = 50;
    let fixed = 0;
    let alreadyOk = 0;
    let noSpecs = 0;
    let errors = 0;
    let processed = 0;

    for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
        const products = await prisma.outputShopify.findMany({
            where: {
                utenteId: UTENTE_SANTE_ID,
                masterFile: {
                    datiIcecat: {
                        specificheTecnicheJson: { not: null }
                    }
                }
            },
            include: {
                masterFile: {
                    include: {
                        datiIcecat: true
                    }
                }
            },
            skip: skip,
            take: BATCH_SIZE
        });

        for (const product of products) {
            processed++;
            try {
                // Check tabella esistente
                let existingTableLength = 0;
                let existingMeta: Record<string, any> = {};

                if (product.metafieldsJson) {
                    existingMeta = JSON.parse(product.metafieldsJson);
                    const existingTable = existingMeta['custom.tabella_specifiche'];
                    existingTableLength = existingTable?.length || 0;
                }

                // Se la tabella esiste ed è lunga, skip
                if (existingTableLength > 500) {
                    alreadyOk++;
                    continue;
                }

                // Genera nuova tabella
                const specsJson = product.masterFile?.datiIcecat?.specificheTecnicheJson;
                if (!specsJson) {
                    noSpecs++;
                    continue;
                }

                const specs = JSON.parse(specsJson);
                const newTable = generateSpecsTable(specs);

                if (!newTable || newTable.length <= existingTableLength) {
                    noSpecs++;
                    continue;
                }

                // Update con nuova tabella
                const newMeta = { ...existingMeta };
                newMeta['custom.tabella_specifiche'] = newTable;

                await prisma.outputShopify.update({
                    where: { id: product.id },
                    data: {
                        metafieldsJson: JSON.stringify(newMeta),
                        statoCaricamento: 'pending' // Reset per risincronizzazione
                    }
                });

                fixed++;
                console.log(`✅ Fixed: ${product.title?.substring(0, 50)} (${existingTableLength} -> ${newTable.length} chars)`);

            } catch (error: any) {
                errors++;
                console.log(`❌ Error: ${product.title?.substring(0, 50)} - ${error.message}`);
            }
        }

        console.log(`   Progresso: ${processed}/${totalCount}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO SANTE:');
    console.log(`   ✅ Tabelle fixate: ${fixed}`);
    console.log(`   ✓  Già OK: ${alreadyOk}`);
    console.log(`   ⚠️  Senza specs valide: ${noSpecs}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log('\n');

    // Se ci sono prodotti fixati, indica che devono essere risincronizzati
    if (fixed > 0) {
        console.log('⚠️  IMPORTANTE: I prodotti fixati sono stati resettati a "pending".');
        console.log('   Per trasmettere le tabelle aggiornate a Shopify, avvia una nuova sincronizzazione.');
    }

    await prisma.$disconnect();
}

fixMissingTablesForSante();
