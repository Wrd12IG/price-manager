import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function testSimple() {
    console.log('🔍 Testing with DIRECT_URL...');
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DIRECT_URL
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

testSimple();
