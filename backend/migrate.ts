
import { PrismaClient } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

async function migrate() {
    console.log('🚀 Inizio migrazione dati da SQLite a Supabase...');

    // Connessione a Supabase (Postgres)
    const prisma = new PrismaClient();

    // Connessione a SQLite locale
    const dbPath = path.join(__dirname, 'prisma/dev.db');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const tables = [
        'utenti',
        'fornitori',
        'marchi',
        'categorie',
        'configurazione_sistema',
        'mappatura_campi',
        'mappatura_categorie',
        'regole_markup',
        'supplier_filters',
        'product_filter_rules',
        'filter_presets',
        'listini_raw',
        'master_file',
        'dati_icecat',
        'output_shopify',
        'log_elaborazioni'
    ];

    for (const table of tables) {
        console.log(`\n📦 Trasloco tabella: ${table}...`);

        try {
            const rows = await db.all(`SELECT * FROM ${table}`);
            console.log(`   Trovate ${rows.length} righe.`);

            if (rows.length === 0) continue;

            // Dividiamo in blocchi di 100 per non intasare Supabase
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);

                // Pulizia dati per Postgres (gestione date e booleani)
                const cleanedChunk = chunk.map(row => {
                    const newRow = { ...row };
                    for (const key in newRow) {
                        // Converti i booleani di SQLite (0/1) in veri booleani
                        if (newRow[key] === 0 && (key === 'attivo' || key === 'attiva' || key === 'escludi')) {
                            newRow[key] = false;
                        } else if (newRow[key] === 1 && (key === 'attivo' || key === 'attiva' || key === 'escludi')) {
                            newRow[key] = true;
                        }

                        // Gestione date
                        if (key.toLowerCase().includes('date') || key.endsWith('At') || key === 'ultimaSincronizzazione') {
                            if (newRow[key]) newRow[key] = new Date(newRow[key]);
                        }

                        // Se id è presente, lo manteniamo
                    }
                    return newRow;
                });

                // @ts-ignore - Usiamo il client Prisma dinamicamente
                await prisma[table].createMany({
                    data: cleanedChunk,
                    skipDuplicates: true
                });

                process.stdout.write(`   Avanzamento: ${Math.min(i + chunkSize, rows.length)}/${rows.length}\r`);
            }
            console.log(`\n   ✅ ${table} completata!`);
        } catch (error) {
            console.error(`   ❌ Errore durante il trasloco di ${table}:`, error.message);
        }
    }

    console.log('\n✨ MIGRAZIONE COMPLETATA CON SUCCESSO! ✨');
    process.exit(0);
}

migrate().catch(err => {
    console.error('💥 Errore fatale nella migrazione:', err);
    process.exit(1);
});
