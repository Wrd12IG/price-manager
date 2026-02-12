import prisma from './src/config/database';

/**
 * Script per visualizzare la tabella HTML generata per i metafields Shopify
 */

// Funzione generateSpecsTable identica a quella in EnhancedMetafieldService
function generateSpecsTable(specs: any): string | null {
    if (!specs) return null;

    const specsList = Array.isArray(specs)
        ? specs
        : Object.entries(specs).map(([name, value]) => ({ name, value }));

    if (specsList.length === 0) return null;

    let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
    let rowsAdded = 0;

    for (const spec of specsList) {
        const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
        const value = spec.value || spec.PresentationValue || '';

        if (!name || !value) continue;

        rowsAdded++;
        tableHtml += `<tr>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${escapeHtml(name)}</strong></td>`;
        tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${escapeHtml(String(value))}</td>`;
        tableHtml += `</tr>`;
    }

    tableHtml += '</table>';
    return rowsAdded > 0 ? tableHtml : null;
}

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

async function showTableExample() {
    try {
        console.log('🔍 Ricerca prodotto ASUS con dati ICECAT...\n');

        const product = await prisma.masterFile.findFirst({
            where: {
                datiIcecat: {
                    isNot: null
                },
                marchio: {
                    nome: { contains: 'ASUS', mode: 'insensitive' }
                }
            },
            include: {
                marchio: true,
                datiIcecat: true
            }
        });

        if (!product || !product.datiIcecat) {
            console.log('❌ Nessun prodotto ASUS con dati ICECAT trovato');
            await prisma.$disconnect();
            return;
        }

        console.log('='.repeat(80));
        console.log('📦 PRODOTTO ESEMPIO:');
        console.log('='.repeat(80));
        console.log('Nome:', product.nomeProdotto);
        console.log('EAN:', product.eanGtin);
        console.log('Marca:', product.marchio?.nome);
        console.log('');

        if (!product.datiIcecat.specificheTecnicheJson) {
            console.log('⚠️  Questo prodotto non ha specifiche tecniche salvate');
            await prisma.$disconnect();
            return;
        }

        const specs = JSON.parse(product.datiIcecat.specificheTecnicheJson);
        console.log('📊 Numero di specifiche:', Array.isArray(specs) ? specs.length : Object.keys(specs).length);
        console.log('');

        const tableHtml = generateSpecsTable(specs);

        if (!tableHtml) {
            console.log('⚠️  Impossibile generare tabella dalle specifiche');
            await prisma.$disconnect();
            return;
        }

        console.log('='.repeat(80));
        console.log('📋 TABELLA HTML GENERATA (CODICE RAW)');
        console.log('='.repeat(80));
        console.log(tableHtml);
        console.log('');
        console.log('');

        console.log('='.repeat(80));
        console.log('📋 TABELLA HTML FORMATTATA (LEGGIBILE)');
        console.log('='.repeat(80));

        // Formatta l'HTML per renderlo più leggibile
        const formattedHtml = tableHtml
            .replace(/<table/g, '\n<table')
            .replace(/<\/table>/g, '\n</table>')
            .replace(/<tr>/g, '\n  <tr>')
            .replace(/<\/tr>/g, '\n  </tr>')
            .replace(/<td/g, '\n    <td')
            .replace(/<\/td>/g, '</td>');

        console.log(formattedHtml);
        console.log('');
        console.log('');

        // Genera anche un file HTML di anteprima
        const htmlPreview = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anteprima Tabella Specifiche - ${product.nomeProdotto}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #0066cc;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .info {
            background: #f0f7ff;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .info p {
            margin: 5px 0;
            color: #555;
        }
        .info strong {
            color: #0066cc;
        }
        table {
            margin-top: 20px;
        }
        td {
            font-size: 14px;
        }
        .code-section {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin-top: 30px;
            border-left: 4px solid #0066cc;
        }
        .code-section h2 {
            margin-top: 0;
            color: #333;
            font-size: 16px;
        }
        pre {
            background: #fff;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 12px;
            border: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Anteprima Tabella Specifiche Shopify</h1>
        
        <div class="info">
            <p><strong>Prodotto:</strong> ${product.nomeProdotto}</p>
            <p><strong>EAN:</strong> ${product.eanGtin}</p>
            <p><strong>Marca:</strong> ${product.marchio?.nome}</p>
            <p><strong>Numero Specifiche:</strong> ${Array.isArray(specs) ? specs.length : Object.keys(specs).length}</p>
        </div>

        <h2>🎨 Come appare su Shopify:</h2>
        ${tableHtml}

        <div class="code-section">
            <h2>💻 Codice HTML Inviato:</h2>
            <pre>${escapeHtml(tableHtml)}</pre>
        </div>

        <div class="code-section">
            <h2>📝 Metafield Shopify:</h2>
            <pre>{
  "namespace": "custom",
  "key": "tabella_specifiche",
  "type": "single_line_text_field",
  "value": "${escapeHtml(tableHtml).replace(/"/g, '\\"')}"
}</pre>
        </div>
    </div>
</body>
</html>`;

        const fs = require('fs');
        const previewPath = './tabella_specifiche_preview.html';
        fs.writeFileSync(previewPath, htmlPreview);

        console.log('='.repeat(80));
        console.log('✅ FILE ANTEPRIMA CREATO');
        console.log('='.repeat(80));
        console.log('File:', previewPath);
        console.log('');
        console.log('💡 Apri il file nel browser per vedere l\'anteprima visuale della tabella');
        console.log('   Comando: open tabella_specifiche_preview.html');
        console.log('');

        console.log('='.repeat(80));
        console.log('📊 CARATTERISTICHE TABELLA');
        console.log('='.repeat(80));
        console.log('✓ Larghezza: 100% (responsive)');
        console.log('✓ Bordi: 1px solid #ddd');
        console.log('✓ Padding celle: 8px');
        console.log('✓ Background intestazioni: #f2f2f2');
        console.log('✓ Stile: border-collapse');
        console.log('✓ Compatibilità: HTML5 + CSS inline');
        console.log('✓ Shopify: Completamente supportato');
        console.log('');

        await prisma.$disconnect();

    } catch (error: any) {
        console.error('❌ Errore:', error.message);
        await prisma.$disconnect();
    }
}

showTableExample();
