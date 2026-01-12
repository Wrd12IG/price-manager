import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script per testare la generazione della tabella HTML delle specifiche
 */
async function testSpecsTable() {
    try {
        console.log('=== TEST TABELLA SPECIFICHE HTML ===\n');

        // Esegui prepareExport su 2 prodotti
        console.log('🔄 Generazione tabelle specifiche per 2 prodotti...\n');
        await ShopifyService.prepareExport(2);

        // Recupera i prodotti
        const products = await prisma.outputShopify.findMany({
            take: 2,
            orderBy: { updatedAt: 'desc' },
            include: {
                masterFile: {
                    select: {
                        eanGtin: true,
                        marca: true,
                        categoriaEcommerce: true
                    }
                }
            }
        });

        const outputDir = path.join(__dirname, '../../test-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (let i = 0; i < products.length; i++) {
            const product = products[i];

            console.log('\n' + '='.repeat(80));
            console.log(`📦 PRODOTTO ${i + 1}: ${product.title}`);
            console.log(`🏷️  EAN: ${product.masterFile?.eanGtin}`);
            console.log(`🏭 Marca: ${product.masterFile?.marca}`);
            console.log(`📂 Categoria: ${product.masterFile?.categoriaEcommerce}`);
            console.log('='.repeat(80));

            if (product.metafieldsJson) {
                try {
                    const metafields = JSON.parse(product.metafieldsJson);

                    // Trova la tabella specifiche
                    const tabellaSpec = metafields.find(
                        (mf: any) => mf.key === 'tabella_specifiche'
                    );

                    if (tabellaSpec) {
                        console.log('\n✅ Tabella specifiche trovata!');
                        console.log(`📏 Lunghezza HTML: ${tabellaSpec.value.length} caratteri`);

                        // Conta le righe
                        const rowCount = (tabellaSpec.value.match(/<tr/g) || []).length;
                        console.log(`📊 Numero di righe: ${rowCount}`);

                        // Salva l'HTML in un file per visualizzazione
                        const filename = `tabella_specifiche_${i + 1}.html`;
                        const filepath = path.join(outputDir, filename);

                        const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Specifiche - ${product.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #212529;
            margin-bottom: 10px;
        }
        .product-info {
            color: #6c757d;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #dee2e6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${product.title}</h1>
        <div class="product-info">
            <p><strong>EAN:</strong> ${product.masterFile?.eanGtin}</p>
            <p><strong>Marca:</strong> ${product.masterFile?.marca}</p>
            <p><strong>Categoria:</strong> ${product.masterFile?.categoriaEcommerce}</p>
        </div>
        ${tabellaSpec.value}
    </div>
</body>
</html>`;

                        fs.writeFileSync(filepath, fullHtml, 'utf-8');
                        console.log(`💾 Tabella salvata in: ${filepath}`);
                        console.log(`🌐 Apri il file nel browser per visualizzare la tabella completa`);

                        // Mostra un'anteprima delle prime righe
                        const preview = tabellaSpec.value.substring(0, 500);
                        console.log('\n📋 ANTEPRIMA HTML (primi 500 caratteri):');
                        console.log('─'.repeat(80));
                        console.log(preview + '...');
                        console.log('─'.repeat(80));

                    } else {
                        console.log('\n❌ Metafield "tabella_specifiche" non trovato');
                    }

                } catch (e) {
                    console.log('\n❌ Errore parsing metafields:', e);
                }
            } else {
                console.log('\n⚠️  Nessun metafield trovato');
            }
        }

        console.log('\n\n=== STATISTICHE ===\n');

        const allProducts = await prisma.outputShopify.findMany({
            where: { metafieldsJson: { not: null } },
            select: { metafieldsJson: true }
        });

        let withTable = 0;
        let avgRows = 0;
        let avgLength = 0;

        allProducts.forEach(p => {
            try {
                const mfs = JSON.parse(p.metafieldsJson!);
                const table = mfs.find((mf: any) => mf.key === 'tabella_specifiche');
                if (table) {
                    withTable++;
                    const rows = (table.value.match(/<tr/g) || []).length;
                    avgRows += rows;
                    avgLength += table.value.length;
                }
            } catch (e) {
                // Skip
            }
        });

        console.log(`📊 Prodotti con tabella specifiche: ${withTable}/${allProducts.length}`);
        if (withTable > 0) {
            console.log(`📏 Media righe per tabella: ${(avgRows / withTable).toFixed(1)}`);
            console.log(`📐 Lunghezza media HTML: ${(avgLength / withTable).toFixed(0)} caratteri`);
        }

        console.log(`\n✅ Test completato!`);
        console.log(`📁 File HTML salvati in: ${outputDir}\n`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testSpecsTable();
