
const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, 'prisma/dev.db');

// Mappa tra nomi tabelle database e modelli Prisma
const modelMap = {
    'utenti': 'utente',
    'fornitori': 'fornitore',
    'marchi': 'marchio',
    'categorie': 'categoria',
    'configurazione_sistema': 'configurazioneSistema',
    'mappatura_campi': 'mappaturaCampo',
    'mappatura_categorie': 'mappaturaCategoria',
    'regole_markup': 'regolaMarkup',
    'supplier_filters': 'supplierFilter',
    'product_filter_rules': 'productFilterRule',
    'filter_presets': 'filterPreset',
    'listini_raw': 'listinoRaw',
    'master_file': 'masterFile',
    'dati_icecat': 'datiIcecat',
    'output_shopify': 'outputShopify',
    'log_elaborazioni': 'logElaborazione'
};

async function migrate() {
    console.log('🚀 Inizio migrazione PROFESSIONALE...');
    const db = new sqlite3.Database(dbPath);

    // Ordine di migrazione per rispettare i collegamenti (Foreign Keys)
    const tables = [
        'utenti', 'fornitori', 'marchi', 'categorie', 'configurazione_sistema',
        'regole_markup', 'mappatura_campi', 'mappatura_categorie', 'supplier_filters',
        'product_filter_rules', 'filter_presets', 'listini_raw', 'master_file',
        'dati_icecat', 'output_shopify', 'log_elaborazioni'
    ];

    for (const table of tables) {
        const modelName = modelMap[table];
        console.log(`\n📦 Tabella: ${table} (Modello Prisma: ${modelName})`);

        const rows = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${table}`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }).catch(err => {
            console.log(`   ⚠️ Salto ${table} (Errore: ${err.message})`);
            return null;
        });

        if (!rows || rows.length === 0) {
            console.log('   Nessun dato da copiare.');
            continue;
        }
        console.log(`   Trovate ${rows.length} righe.`);

        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const cleanedChunk = chunk.map(row => {
                const newRow = { ...row };
                for (const key in newRow) {
                    if (newRow[key] === 0 && (key === 'attivo' || key === 'attiva' || key === 'escludi')) newRow[key] = false;
                    if (newRow[key] === 1 && (key === 'attivo' || key === 'attiva' || key === 'escludi')) newRow[key] = true;
                    if (key.toLowerCase().includes('date') || key.endsWith('At') || key === 'ultimaSincronizzazione') {
                        if (newRow[key]) newRow[key] = new Date(newRow[key]);
                    }
                }
                return newRow;
            });

            try {
                if (prisma[modelName]) {
                    await prisma[modelName].createMany({
                        data: cleanedChunk,
                        skipDuplicates: true
                    });
                    process.stdout.write(`   Avanzamento: ${Math.min(i + chunkSize, rows.length)}/${rows.length}\r`);
                } else {
                    console.error(`\n   ❌ Modello ${modelName} non trovato in Prisma!`);
                }
            } catch (err) {
                console.error(`\n   ❌ Errore blocco ${i}:`, err.message);
            }
        }
        console.log(`\n   ✅ ${table} completata!`);
    }
    console.log('\n✨ TRASLOCO COMPLETATO! TUTTI I DATI SONO SU SUPABASE! ✨');
    db.close();
}

migrate();
