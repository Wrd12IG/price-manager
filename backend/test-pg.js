const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function testConn() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL.replace('pooler.supabase.com:5432', 'db.apafzmiuvffewljfgfro.supabase.co:5432'),
        connectionTimeoutMillis: 5000,
    });

    try {
        console.log('🔍 Connecting to:', client.connectionParameters.host);
        await client.connect();
        console.log('✅ Connected!');
        const res = await client.query('SELECT 1 as test');
        console.log('✅ Query result:', res.rows);

        console.log('👥 Checking utenti table...');
        const resUsers = await client.query('SELECT count(*) FROM utenti');
        console.log('👥 User count:', resUsers.rows[0].count);

        await client.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

testConn();
