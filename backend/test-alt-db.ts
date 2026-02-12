
import { PrismaClient } from '@prisma/client';

async function testConnection(url: string, label: string) {
    console.log(`\n🔍 Testing ${label}...`);
    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });
    try {
        await prisma.$connect();
        const count = await prisma.utente.count();
        console.log(`✅ ${label} connected! Users count: ${count}`);
        return true;
    } catch (error: any) {
        console.error(`❌ ${label} failed: ${error.message}`);
        return false;
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    // Project ID from .env.production
    const url1 = "postgresql://postgres.apafzmiuvffewljfgfro:VWzy7uufEmv4fq3Y@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require";

    // Project ID from SOLUZIONE_LOGIN_BLOCCATO.md
    const url2 = "postgresql://postgres.cvqotrwbvvafkabhlmkx:Supabase2024!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require";

    await testConnection(url1, "Project apafzmiuvffewljfgfro (from .env.production)");
    await testConnection(url2, "Project cvqotrwbvvafkabhlmkx (from docs)");
}

main();
