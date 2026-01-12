
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function analyzeCometaFile() {
    try {
        const fornitore = await prisma.fornitore.findUnique({
            where: { id: 3 } // Cometa
        });

        if (!fornitore || !fornitore.urlListino) {
            console.error('Fornitore Cometa non trovato o URL mancante');
            return;
        }

        console.log(`Scaricamento file da ${fornitore.urlListino}...`);
        const response = await axios.get(fornitore.urlListino, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const content = buffer.toString('utf-8'); // Assumiamo UTF-8 per ora

        console.log(`File scaricato. Dimensione: ${content.length} bytes`);

        // Parsing CSV
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            delimiter: ';' // Cometa usa ; di solito
        });

        console.log(`Totale righe nel CSV: ${records.length}`);

        let validEanCount = 0;
        let invalidEanCount = 0;
        let emptyEanCount = 0;

        // Campione di EAN scartati
        const invalidSamples: any[] = [];

        records.forEach((row: any, index: number) => {
            const ean = row['CodiceEAN']; // Colonna mappata

            if (!ean || ean.trim() === '') {
                emptyEanCount++;
                if (invalidSamples.length < 5) invalidSamples.push({ reason: 'Empty', row });
            } else {
                // Logica di validazione usata in ImportService
                const cleaned = ean.trim();
                const isNumeric = /^\d+$/.test(cleaned);

                if (isNumeric) {
                    validEanCount++;
                } else {
                    invalidEanCount++;
                    if (invalidSamples.length < 10) invalidSamples.push({ reason: 'Not Numeric', ean: cleaned, row });
                }
            }
        });

        console.log(`\n--- ANALISI COLONNA 'CodiceEAN' ---`);
        console.log(`EAN Validi (Numerici): ${validEanCount}`);
        console.log(`EAN Vuoti: ${emptyEanCount}`);
        console.log(`EAN Non Numerici (Scartati): ${invalidEanCount}`);

        if (invalidSamples.length > 0) {
            console.log(`\n--- ESEMPI SCARTATI ---`);
            console.log(JSON.stringify(invalidSamples, null, 2));
        }

    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeCometaFile();
