import prisma from './src/config/database';

async function diagnoseDatabase() {
    try {
        console.log('🔍 Database Diagnosis Start...');

        // Check if we can connect at all
        await prisma.$connect();
        console.log('✅ Connected to database');

        // Check tables by querying the information schema
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `;
        console.log('📋 Tables in public schema:', JSON.stringify(tables, null, 2));

        // Let's count users in 'utenti'
        try {
            const userCount = await prisma.$queryRaw`SELECT COUNT(*) FROM utenti`;
            console.log('👥 User count in "utenti":', JSON.stringify(userCount, null, 2));
        } catch (e) {
            console.log('❌ Error querying "utenti" table:', e.message);
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
    }
}

diagnoseDatabase();
