import axios from 'axios';
import fs from 'fs';
import readline from 'readline';

async function analyzeCometaFile() {
    const url = 'http://dati.cometanet.net:20000/xml/Listinocsv.ashx?user=22276&pass=06249960722';
    console.log(`Scaricamento listino Cometa da: ${url}`);

    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream'
        });

        const rl = readline.createInterface({
            input: response.data,
            crlfDelay: Infinity
        });

        let lineCount = 0;
        let asusCount = 0;
        let notebookCount = 0;
        let asusNotebookCount = 0;
        let header: string[] = [];

        console.log('Analisi in corso...');

        for await (const line of rl) {
            lineCount++;

            // Parsa CSV (semplice split per ora, assumendo ; come separatore)
            const parts = line.split(';');

            if (lineCount === 1) {
                header = parts;
                console.log('Header RAW:', JSON.stringify(header));
                // Pulisci header per uso interno dello script
                header = header.map(h => h.replace(/"/g, '').trim());
                continue;
            }

            // Trova indici colonne
            const idxMarca = header.indexOf('Produttore');
            const idxCat = header.indexOf('DescriCatOmo');
            const idxDesc = header.indexOf('Descrizione');
            const idxEan = header.indexOf('CodiceEAN');

            if (idxMarca === -1 || idxCat === -1) {
                console.error('Colonne Produttore o DescriCatOmo non trovate nell\'header!');
                break;
            }

            const idxSku = header.indexOf('Articolo');
            const idxPrezzo = header.indexOf('Prezzo');

            const marca = parts[idxMarca]?.replace(/"/g, '').trim().toUpperCase();
            const categoria = parts[idxCat]?.replace(/"/g, '').trim().toUpperCase();
            const descrizione = parts[idxDesc]?.replace(/"/g, '').trim();
            const ean = parts[idxEan]?.replace(/"/g, '').trim();
            const sku = parts[idxSku]?.replace(/"/g, '').trim();
            const prezzo = parts[idxPrezzo]?.replace(/"/g, '').trim();

            if (lineCount >= 7440 && lineCount <= 7455) {
                console.log(`Riga ${lineCount}: ${line}`);
            }

            if (marca === 'ASUS') {
                asusCount++;
            }

            if (categoria === 'NOTEBOOK') {
                notebookCount++;
            }

            if (marca === 'ASUS' && categoria === 'NOTEBOOK') {
                asusNotebookCount++;
                if (asusNotebookCount <= 10) {
                    console.log(`\nNotebook Asus trovato (#${asusNotebookCount}):`);
                    console.log(`   EAN: ${ean}`);
                    console.log(`   SKU: ${sku}`);
                    console.log(`   Prezzo: ${prezzo}`);
                    console.log(`   Descrizione: ${descrizione}`);
                    console.log(`   Categoria: ${categoria}`);

                    // Verifica validità EAN
                    if (!ean || ean.length > 13 || !/^\d+$/.test(ean)) {
                        console.log(`   ⚠️  EAN INVALIDO! Questo prodotto verrà scartato.`);
                    } else {
                        console.log(`   ✅ EAN Valido.`);
                    }
                }
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('RISULTATI ANALISI FILE RAW');
        console.log('='.repeat(50));
        console.log(`Totale righe: ${lineCount}`);
        console.log(`Prodotti marca ASUS: ${asusCount}`);
        console.log(`Prodotti categoria NOTEBOOK: ${notebookCount}`);
        console.log(`Notebook ASUS: ${asusNotebookCount}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('Errore durante il download o analisi:', error);
    }
}

analyzeCometaFile();
