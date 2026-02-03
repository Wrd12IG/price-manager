import prisma from '../config/database';

function generateSpecsTableDebug(specs: any): string | null {
    console.log('📋 Inizio generazione tabella...');

    if (!specs || (Array.isArray(specs) && specs.length === 0)) {
        console.log('   ❌ Specs vuoto o non valido');
        return null;
    }

    const specsList = Array.isArray(specs) ? specs : Object.entries(specs).map(([name, value]) => ({ name, value }));

    console.log(`   📊 SpecsList length: ${specsList.length}`);

    if (specsList.length === 0) {
        console.log('   ❌ SpecsList vuoto dopo conversione');
        return null;
    }

    let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
    let rowsAdded = 0;

    for (const spec of specsList) {
        const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
        const value = spec.value || spec.PresentationValue || '';

        if (!name) {
            console.log(`   ⚠️ Skip spec - name vuoto, value: '${String(value).substring(0, 30)}'`);
            continue;
        }

        if (!value) {
            console.log(`   ⚠️ Skip spec - name: '${name}', value vuoto`);
            continue;
        }

        rowsAdded++;
        if (rowsAdded <= 5) {
            console.log(`   ✅ Row ${rowsAdded}: ${name} = ${String(value).substring(0, 50)}`);
        }

        tableHtml += `<tr>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${name}</strong></td>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${value}</td>`;
        tableHtml += `</tr>`;
    }

    tableHtml += '</table>';
    console.log(`   📊 Totale righe aggiunte: ${rowsAdded}`);
    console.log(`   📏 Lunghezza HTML: ${tableHtml.length} caratteri`);

    return tableHtml;
}

async function testGeneration() {
    const prodotti = await prisma.masterFile.findMany({
        where: {
            datiIcecat: {
                specificheTecnicheJson: { not: null }
            }
        },
        include: { datiIcecat: true },
        take: 3
    });

    for (const p of prodotti) {
        if (p?.datiIcecat?.specificheTecnicheJson) {
            console.log(`\n\n🧪 ==================== TEST PRODOTTO ====================`);
            console.log(`📦 Prodotto: ${p.nomeProdotto || p.eanGtin}`);

            try {
                const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                console.log(`   Specs è Array: ${Array.isArray(specs)}`);
                console.log(`   Numero specs: ${specs.length}`);

                const result = generateSpecsTableDebug(specs);

                if (result) {
                    console.log(`\n✅ SUCCESSO - Tabella generata correttamente`);
                    console.log(`   Anteprima: ${result.substring(0, 200)}...`);
                } else {
                    console.log(`\n❌ FALLITO - La funzione ha ritornato NULL`);
                }
            } catch (e: any) {
                console.log(`\n❌ ERRORE: ${e.message}`);
            }
        }
    }

    await prisma.$disconnect();
}

testGeneration();
