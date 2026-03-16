import { ShopifyExportService } from '../services/ShopifyExportService';
import prisma from '../config/database';

async function generateExport() {
    console.log('🚀 Avvio generazione export Shopify...');
    
    try {
        await ShopifyExportService.generateExport(1);
        console.log('✅ Generazione export completata con successo.');
    } catch (error: any) {
        console.error('❌ Errore durante la generazione dell\'export:', error.message);
    }

    await prisma.$disconnect();
}

generateExport().catch(console.error);
