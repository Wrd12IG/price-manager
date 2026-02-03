import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.utente.findFirst();
    if (!user) {
        console.error('Nessun utente trovato nel database. Impossibile migrare.');
        return;
    }

    const uid = user.id;
    console.log(`🚀 Avvio migrazione multi-tenant per utente ID: ${uid}`);

    const tables = [
        'fornitori',
        'regole_markup',
        'listini_raw',
        'master_file',
        'log_elaborazioni',
        'configurazione_sistema',
        'product_filter_rules',
        'filter_presets'
    ];

    for (const table of tables) {
        try {
            console.log(`- Elaborazione tabella: ${table}`);
            // Aggiungi colonna colonna utenteId se manca
            await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "utenteId" INTEGER`);
            // Imposta valore default per record esistenti
            await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "utenteId" = ${uid} WHERE "utenteId" IS NULL`);
            // Rendi non nullable (opzionale, ma consigliato per schema)
            // await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ALTER COLUMN "utenteId" SET NOT NULL`);
        } catch (e: any) {
            console.warn(`⚠️ Errore su tabella ${table}: ${e.message}`);
        }
    }

    console.log('✅ Migrazione dati completata.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
