
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

        const user = await prisma.utente.findUnique({
            where: { email: 'sante.dormio@gmail.com' },
            select: { id: true, email: true, attivo: true, ruolo: true }
        });

        if (user) {
            console.log(`👤 Sante found! ID: ${user.id}, Active: ${user.attivo}, Role: ${user.ruolo}`);
        } else {
            console.log(`❌ Sante NOT found.`);
        }

    } catch (error) {
        console.error(`❌ Failed for ${name}:`, error.message);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    // Attempt with direct host
    const directUrl = "postgresql://postgres.apafzmiuvffewljfgfro:VWzy7uufEmv4fq3Y@db.apafzmiuvffewljfgfro.supabase.co:5432/postgres";
    await testConnection(directUrl, "Supabase Direct URL");
}

main();
