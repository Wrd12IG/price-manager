/**
 * 💣 RESET COMPLETO CATALOGO UTENTE
 * 
 * Questo script:
 * 1. Opzionalmente elimina i prodotti fisicamente da Shopify (via API)
 * 2. Elimina tutti i record da OutputShopify dell'utente
 * 3. Elimina tutti i record da MasterFile dell'utente
 * 
 * USO:
 *   npx tsx src/scripts/reset_user_catalog.ts --utente=ID           → Mock run (mostra cosa farebbe)
 *   npx tsx src/scripts/reset_user_catalog.ts --utente=ID --confirm → Reset solo database locale
 *   npx tsx src/scripts/reset_user_catalog.ts --utente=ID --confirm --delete-shopify → Reset locale + Shopify
 */

import prisma from '../config/database';
import { MasterFileService } from '../services/MasterFileService';

async function main() {
    const args = process.argv.slice(2);
    const utenteIdArg = args.find(a => a.startsWith('--utente='));
    const isConfirmed = args.includes('--confirm');
    const deleteShopify = args.includes('--delete-shopify');

    if (!utenteIdArg) {
        console.error('❌ Errore: Devi specificare l\'ID utente. Esempio: --utente=1');
        process.exit(1);
    }

    const utenteId = parseInt(utenteIdArg.split('=')[1]);
    if (isNaN(utenteId)) {
        console.error('❌ Errore: ID utente non valido.');
        process.exit(1);
    }

    const utente = await prisma.utente.findUnique({ where: { id: utenteId } });
    if (!utente) {
        console.error(`❌ Errore: Utente con ID ${utenteId} non trovato.`);
        process.exit(1);
    }

    console.log(`\n🚀 ===== RESET CATALOGO UTENTE: ${utente.email} (ID: ${utenteId}) =====\n`);

    // Controllo stato attuale
    const masterCount = await prisma.masterFile.count({ where: { utenteId } });
    const outputCount = await prisma.outputShopify.count({ where: { utenteId } });
    const shopifyCount = await prisma.outputShopify.count({
        where: { utenteId, shopifyProductId: { not: null } }
    });

    console.log('📊 STATO ATTUALE:');
    console.log(`   - Prodotti Master File: ${masterCount}`);
    console.log(`   - Record Output Shopify: ${outputCount}`);
    console.log(`   - Prodotti già su Shopify (ID presenti): ${shopifyCount}`);

    if (!isConfirmed) {
        console.log('\n⚠️  MODALITÀ ANTEPRIMA (nessuna modifica applicata)');
        console.log('   Per procedere con il reset del database locale, aggiungi: --confirm');
        console.log('   Per eliminare ANCHE i prodotti da Shopify, aggiungi: --delete-shopify');

        console.log('\n👉 Esempio comando completo:');
        console.log(`   npx tsx src/scripts/reset_user_catalog.ts --utente=${utenteId} --confirm --delete-shopify`);
        return;
    }

    console.log('\n⚠️  ATTENZIONE: Operazione in corso tra 3 secondi...');
    if (deleteShopify) {
        console.log('   🔥 I prodotti verranno eliminati fisicamente da Shopify!');
    }
    await new Promise(r => setTimeout(r, 3000));

    try {
        const result = await MasterFileService.resetUserCatalog(utenteId, deleteShopify);

        console.log('\n✅ RESET COMPLETATO CON SUCCESSO:');
        console.log(`   - Record Master File eliminati: ${result.masterDeleted}`);
        console.log(`   - Record Output Shopify eliminati: ${result.outputDeleted}`);
        if (deleteShopify) {
            console.log(`   - Prodotti eliminati da Shopify: ${result.shopifyDeleted}`);
            console.log(`   - Errori durante eliminazione Shopify: ${result.shopifyErrors}`);
        }

        console.log('\n📌 Prossimi passi:');
        console.log('   1. Riavvia l\'importazione dei listini (Phase 1)');
        console.log('   2. Esegui il consolidamento (Phase 3)');
        console.log('   3. Rigenera l\'export Shopify (Phase 7)');

    } catch (error: any) {
        console.error('\n❌ ERRORE CRITICO DURANTE IL RESET:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
