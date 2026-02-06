/**
 * Script per rigenerare le tabelle specifiche mancanti o corte
 * per l'account SANTE (utente ID 2) e altri utenti
 */
import prisma from './src/config/database';

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

async function fixMissingTables() {
    console.log('🔧 FIX TABELLE SPECIFICHE MANCANTI O CORTE\n');
    console.log('='.repeat(60));

    // Trova tutti i prodotti con tabella corta o mancante
    const products = await prisma.outputShopify.findMany({
        where: {
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
        }
    });

    console.log(`📊 Trovati ${products.length} prodotti con specifiche ICECAT\n`);

    let fixed = 0;
    let alreadyOk = 0;
    let noSpecs = 0;
    let errors = 0;

    for (const product of products) {
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
                    metafieldsJson: JSON.stringify(newMeta)
                }
            });

            fixed++;
            console.log(`✅ Fixed: ${product.title?.substring(0, 50)} (${existingTableLength} -> ${newTable.length} chars)`);

        } catch (error: any) {
            errors++;
            console.log(`❌ Error: ${product.title?.substring(0, 50)} - ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO:');
    console.log(`   ✅ Tabelle fixate: ${fixed}`);
    console.log(`   ✓  Già OK: ${alreadyOk}`);
    console.log(`   ⚠️  Senza specs: ${noSpecs}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log('\n');

    await prisma.$disconnect();
}

fixMissingTables();
