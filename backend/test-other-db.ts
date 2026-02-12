import { PrismaClient } from '@prisma/client';

async function testOther() {
    const url = "postgresql://postgres.cvqotrwbvvafkabhlmkx:Supabase2024!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";
    console.log('🔍 Testing OTHER database from SOLUZIONE_LOGIN_BLOCCATO.md...');
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
        const users = await prisma.$queryRaw`SELECT id, email FROM utenti`;
        console.log('👥 Users:', JSON.stringify(users, null, 2));

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testOther();
