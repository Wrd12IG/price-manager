
import prisma from '../config/database';
import { MarkupService } from '../services/MarkupService';
import { ShopifyService } from '../services/ShopifyService';

async function runFullProcess() {
    console.log('🚀 AVVIO PROCESSO COMPLETO DI AGGIORNAMENTO\n');

    try {
        const user = await prisma.utente.findFirst();
        if (!user) throw new Error('User not found');

        // 1. Ricalcolo Prezzi
        console.log('1️⃣  Ricalcolo Prezzi (Markup)...');
        const markupResult = await MarkupService.applicaRegolePrezzi(user.id);
        console.log(`   ✅ Prezzi aggiornati: ${markupResult.updated}`);

        // 2. Preparazione Export Shopify (genera Metafields)
        console.log('\n2️⃣  Preparazione Export Shopify (Metafields)...');
        // Usiamo ShopifyExportService direttamente per la generazione
        const { ShopifyExportService } = await import('../services/ShopifyExportService');
        await ShopifyExportService.generateExport(user.id);
        console.log('   ✅ Export preparato');

        // 3. Verifica Risultati
        console.log('\n3️⃣  Verifica Finale...');

        // Verifica Markup Notebook
        const notebooks = await prisma.masterFile.count({
            where: {
                categoria: { nome: { contains: 'NOTEBOOK' } },
                prezzoVenditaCalcolato: { gt: 0 }
            }
        });
        console.log(`   Notebook con prezzo: ${notebooks}`);

        // Verifica Metafields
        const metafields = await prisma.outputShopify.count({
            where: { metafieldsJson: { not: null } }
        });
        console.log(`   Prodotti con metafields generati: ${metafields}`);

    } catch (error) {
        console.error('❌ ERRORE DURANTE IL PROCESSO:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runFullProcess();
