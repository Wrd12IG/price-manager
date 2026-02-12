import { Client } from 'pg';

async function testPure() {
    // Prova connessione DIRETTA (non pooler)
    const client = new Client({
        host: 'db.apafzmiuvffewljfgfro.supabase.co',
        port: 5432,
        user: 'postgres',
        password: 'VWzy7uufEmv4fq3Y',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔍 Connecting DIRECTLY to db.apafzmiuvffewljfgfro.supabase.co:5432...');
        await client.connect();
        console.log('✅ Connected!');
        const res = await client.query('SELECT 1 as test');
        console.log('✅ Query result:', res.rows);
        await client.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

testPure();
