
import { PrismaClient } from '@prisma/client';

async function testConnection(url: string, name: string) {
    console.log(`\nTesting connection for: ${name}`);
    const prisma = new PrismaClient({
        datasources: {
            db: { url }
        }
    });

    try {
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log(`✅ Success for ${name}`);

        const users = await prisma.utente.findMany({
            select: { id: true, email: true, attivo: true }
        });
        console.log(`Users found:`, users);

        const sante = users.find(u => u.email === 'sante.dormio@gmail.com');
        if (sante) {
            console.log(`👤 Sante found! ID: ${sante.id}, Active: ${sante.attivo}`);
        } else {
            console.log(`❌ Sante NOT found in this database.`);
        }

    } catch (error) {
        console.error(`❌ Failed for ${name}:`, error.message);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    const envUrl = "postgresql://postgres.apafzmiuvffewljfgfro:spPXia8hITriDyHI@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    const prodUrl = "postgresql://postgres.apafzmiuvffewljfgfro:VWzy7uufEmv4fq3Y@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    const recoveryUrl = "postgresql://postgres.cvqotrwbvvafkabhlmkx:Supabase2024!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

    await testConnection(envUrl, ".env DATABASE_URL");
    await testConnection(prodUrl, ".env.production DATABASE_URL");
    await testConnection(recoveryUrl, "SOLUZIONE_LOGIN_BLOCCATO.md URL");
}

main();
