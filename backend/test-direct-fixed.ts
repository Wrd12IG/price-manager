import { PrismaClient } from '@prisma/client';

async function testDirect() {
    // Note: using the actual project host for direct connection
    const url = "postgresql://postgres.apafzmiuvffewljfgfro:spPXia8hITriDyHI@db.apafzmiuvffewljfgfro.supabase.co:5432/postgres?sslmode=require";
    console.log('🔍 Testing DIRECT connection to db.apafzmiuvffewljfgfro.supabase.co...');
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: url
            }
        }
    });

    try {
        console.log('🔍 Connecting...');
        await prisma.$connect();
        console.log('✅ Connected.');
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Result:', result);

        console.log('👥 Checking users...');
        const users = await prisma.$queryRaw`SELECT id, email, attivo FROM utenti`;
        console.log('👥 Users:', JSON.stringify(users, null, 2));

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testDirect();
