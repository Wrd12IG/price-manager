import prisma from './src/config/database';

// Test inline della funzione generateSpecsTable
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
        console.log('generateSpecsTable: specs vuoto o null');
        return null;
    }

    const specsList = Array.isArray(specs) ? specs : Object.entries(specs).map(([name, value]) => ({ name, value }));

    if (specsList.length === 0) {
        console.log('generateSpecsTable: specsList vuoto dopo conversione');
        return null;
    }

    let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
    let rowsAdded = 0;

    for (const spec of specsList) {
        const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
        const value = spec.value || spec.PresentationValue || '';

        console.log(`Spec: name='${name}', value='${value}', !name=${!name}, !value=${!value}`);

        if (!name || !value) {
            console.log(`Skip: name=${!!name}, value=${!!value}`);
            continue;
        }

        rowsAdded++;
        tableHtml += `<tr>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${escapeHtml(name)}</strong></td>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${escapeHtml(String(value))}</td>`;
        tableHtml += `</tr>`;
    }

    tableHtml += '</table>';

    console.log(`Generata tabella con ${rowsAdded} righe (${tableHtml.length} char) da ${specsList.length} specs`);

    return tableHtml;
}

async function check() {
    const product = await prisma.outputShopify.findFirst({
        where: { barcode: '4711387861455' },
        include: { masterFile: { include: { datiIcecat: true } } }
    });
    
    if (product?.masterFile?.datiIcecat?.specificheTecnicheJson) {
        const specs = JSON.parse(product.masterFile.datiIcecat.specificheTecnicheJson);
        console.log('Numero specs:', specs.length);
        console.log('\n=== TEST GENERAZIONE TABELLA ===\n');
        
        const table = generateSpecsTable(specs);
        console.log('\n=== TABELLA GENERATA ===');
        console.log('Lunghezza:', table?.length);
        console.log('Prime 500 chars:', table?.substring(0, 500));
    }
    
    await prisma.$disconnect();
}
check();
