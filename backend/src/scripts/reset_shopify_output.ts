// @ts-nocheck
/**
 * 🔄 RESET COMPLETO OUTPUT SHOPIFY
 *
 * Da usare DOPO aver cancellato tutti i prodotti dal pannello Shopify.
 * Azzera shopifyProductId e riporta tutti i record a 'pending'
 * così la prossima sync li ricrea tutti da zero, puliti.
 *
 * USO:
 *   npx ts-node src/scripts/reset_shopify_output.ts           → mostra stato attuale (dry-run)
 *   npx ts-node src/scripts/reset_shopify_output.ts --confirm → esegue il reset
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetShopifyOutput() {
    try {
        const args = process.argv.slice(2);
        const isConfirmed = args.includes('--confirm');
        const utenteIdArg = args.find(a => a.startsWith('--utente='));
        const utenteId = utenteIdArg ? parseInt(utenteIdArg.split('=')[1]) : null;

        console.log('\n🔄 ===== RESET OUTPUT SHOPIFY =====\n');

        const whereFilter = utenteId ? { utenteId } : {};

        // Stato attuale
        const [total, uploaded, pending, errors, conId] = await Promise.all([
            prisma.outputShopify.count({ where: whereFilter }),
            prisma.outputShopify.count({ where: { ...whereFilter, statoCaricamento: 'uploaded' } }),
            prisma.outputShopify.count({ where: { ...whereFilter, statoCaricamento: 'pending' } }),
            prisma.outputShopify.count({ where: { ...whereFilter, statoCaricamento: 'error' } }),
            prisma.outputShopify.count({ where: { ...whereFilter, shopifyProductId: { not: null } } }),
        ]);

        console.log('📊 STATO ATTUALE:');
        console.log(`   Totale record:     ${total}`);
        console.log(`   ✅ Uploaded:       ${uploaded}  ← questi verranno resettati`);
        console.log(`   📤 Pending:        ${pending}`);
        console.log(`   ❌ Error:          ${errors}`);
        console.log(`   🔗 Con Shopify ID: ${conId}  ← questi verranno azzerati`);
        if (utenteId) {
            console.log(`\n   🎯 Filtro: utente ID ${utenteId}`);
        } else {
            console.log(`\n   🎯 Nessun filtro: reset per TUTTI gli utenti`);
        }

        if (!isConfirmed) {
            console.log('\n⚠️  MODALITÀ DRY-RUN (nessuna modifica applicata)');
            console.log('   Aggiungi --confirm per eseguire effettivamente il reset.');
            console.log(`\n   Comando completo:`);
            if (utenteId) {
                console.log(`   npx ts-node src/scripts/reset_shopify_output.ts --utente=${utenteId} --confirm`);
            } else {
                console.log(`   npx ts-node src/scripts/reset_shopify_output.ts --confirm`);
            }
            return;
        }

        // Esegui reset
        console.log('\n🔄 Esecuzione reset...');
        const result = await prisma.outputShopify.updateMany({
            where: whereFilter,
            data: {
                statoCaricamento: 'pending',
                shopifyProductId: null,
                errorMessage: null,
                isAiEnriched: false,   // forza rigenerazione AI metafields
            }
        });

        console.log(`\n✅ Reset completato! ${result.count} record aggiornati.`);
        console.log('\n📌 PROSSIMI PASSI:');
        console.log('   1. Verifica che tutti i prodotti siano stati eliminati da Shopify');
        console.log('   2. Vai su Price Manager → Integrazioni → Sincronizza con Shopify');
        console.log('   3. La sync creerà tutti i prodotti da zero (POST), senza duplicati');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetShopifyOutput();
