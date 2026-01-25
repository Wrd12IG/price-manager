#!/usr/bin/env node
/**
 * Script di migrazione dati da SQLite locale a Supabase via API
 * Invia i dati attraverso il backend deployato su Render.com
 */

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const API_BASE = 'https://price-manager-5ait.onrender.com/api';
const DB_PATH = path.join(__dirname, 'backend/prisma/dev.db');

// Delay per rispettare rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function migrateMarchi() {
    console.log('\n📦 Migrazione MARCHI...');
    const db = new sqlite3.Database(DB_PATH);

    return new Promise((resolve, reject) => {
        db.all('SELECT nome, normalizzato, attivo, note FROM marchi', async (err, rows) => {
            if (err) return reject(err);

            let success = 0, errors = 0;
            for (const row of rows) {
                try {
                    await axios.post(`${API_BASE}/marchi`, {
                        nome: row.nome,
                        attivo: row.attivo === 1,
                        note: row.note || ''
                    }, { timeout: 30000 });
                    success++;
                    process.stdout.write(`\r   Migrati: ${success}/${rows.length}`);
                } catch (e) {
                    if (e.response?.status === 409) {
                        // Già esiste, skip
                    } else {
                        errors++;
                    }
                }
                await delay(100); // Rate limiting
            }
            console.log(`\n   ✅ Marchi migrati: ${success}, Errori: ${errors}`);
            db.close();
            resolve(success);
        });
    });
}

async function migrateCategorie() {
    console.log('\n📦 Migrazione CATEGORIE...');
    const db = new sqlite3.Database(DB_PATH);

    return new Promise((resolve, reject) => {
        db.all('SELECT nome, normalizzato, attivo, note FROM categorie', async (err, rows) => {
            if (err) return reject(err);

            let success = 0, errors = 0;
            for (const row of rows) {
                try {
                    await axios.post(`${API_BASE}/categorie`, {
                        nome: row.nome,
                        attivo: row.attivo === 1,
                        note: row.note || ''
                    }, { timeout: 30000 });
                    success++;
                    process.stdout.write(`\r   Migrate: ${success}/${rows.length}`);
                } catch (e) {
                    if (e.response?.status === 409) {
                        // Già esiste, skip
                    } else {
                        errors++;
                    }
                }
                await delay(100);
            }
            console.log(`\n   ✅ Categorie migrate: ${success}, Errori: ${errors}`);
            db.close();
            resolve(success);
        });
    });
}

async function migrateFornitori() {
    console.log('\n📦 Migrazione FORNITORI...');
    const db = new sqlite3.Database(DB_PATH);

    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM fornitori', async (err, rows) => {
            if (err) return reject(err);

            let success = 0, errors = 0;
            for (const row of rows) {
                try {
                    await axios.post(`${API_BASE}/fornitori`, {
                        nomeFornitore: row.nomeFornitore,
                        urlListino: row.urlListino || '',
                        formatoFile: row.formatoFile || 'CSV',
                        tipoAccesso: row.tipoAccesso || 'direct_url',
                        username: row.username || '',
                        password: '', // Non migrare password criptate
                        ftpHost: row.ftpHost || '',
                        ftpPort: row.ftpPort || 21,
                        ftpDirectory: row.ftpDirectory || '',
                        attivo: row.attivo === 1,
                        encoding: row.encoding || 'UTF-8',
                        separatoreCSV: row.separatoreCSV || ';',
                        frequenzaAggiornamento: row.frequenzaAggiornamento || 'daily'
                    }, { timeout: 30000 });
                    success++;
                    console.log(`   ✅ Fornitore "${row.nomeFornitore}" migrato`);
                } catch (e) {
                    if (e.response?.status === 409) {
                        console.log(`   ⏭️ Fornitore "${row.nomeFornitore}" già esistente`);
                    } else {
                        console.log(`   ❌ Errore fornitore "${row.nomeFornitore}": ${e.message}`);
                        errors++;
                    }
                }
                await delay(200);
            }
            console.log(`\n   ✅ Fornitori migrati: ${success}, Errori: ${errors}`);
            db.close();
            resolve(success);
        });
    });
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   MIGRAZIONE DATI: SQLite Locale → Supabase (via API)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n🔗 Backend API: ${API_BASE}`);
    console.log(`📁 Database locale: ${DB_PATH}`);

    // Verifica che il backend sia raggiungibile
    console.log('\n🔄 Verifica connessione backend...');
    try {
        const health = await axios.get(`${API_BASE.replace('/api', '')}/health`, { timeout: 60000 });
        console.log(`   ✅ Backend online: ${JSON.stringify(health.data)}`);
    } catch (e) {
        console.log('   ❌ Backend non raggiungibile. Attendi che Render si "svegli"...');
        console.log('   Riprovo tra 30 secondi...');
        await delay(30000);
    }

    const startTime = Date.now();

    try {
        await migrateMarchi();
        await migrateCategorie();
        await migrateFornitori();

        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`   ✅ MIGRAZIONE COMPLETATA in ${duration} minuti!`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n📝 Prossimi passi:');
        console.log('   1. Vai su https://price-manager-backend.vercel.app/dashboard');
        console.log('   2. Configura le mappature campi per ogni fornitore');
        console.log('   3. Esegui "Importa Listino" per popolare il master file');

    } catch (error) {
        console.error('\n❌ Errore durante la migrazione:', error.message);
        process.exit(1);
    }
}

main();
