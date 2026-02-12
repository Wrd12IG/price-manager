const { PrismaClient } = require('@prisma/client');

const SUPABASE_URL = "postgresql://postgres.apafzmiuvffewljfgfro:spPXia8hITriDyHI@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const supabase = new PrismaClient({ datasources: { db: { url: SUPABASE_URL } } });

async function check() {
    try {
        console.log('🔍 Checking Supabase counts...');
        const masterFile = await supabase.masterFile.count();
        const datiIcecat = await supabase.datiIcecat.count();
        const outputShopify = await supabase.outputShopify.count();

        console.log(`- MasterFile: ${masterFile}`);
        console.log(`- DatiIcecat: ${datiIcecat}`);
        console.log(`- OutputShopify: ${outputShopify}`);

        await supabase.$disconnect();
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

check();
