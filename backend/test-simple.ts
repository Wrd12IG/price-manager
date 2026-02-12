import prisma from './src/config/database';

async function testSimple() {
    try {
        console.log('🔍 Testing SELECT 1...');
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Result:', result);
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSimple();
