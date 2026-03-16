import { MasterFileService } from '../services/MasterFileService';
import prisma from '../config/database';

async function runNormalization() {
    console.log('🚀 Avvio normalizzazione categorie nel Master File...');
    
    try {
        const stats = await MasterFileService.normalizeCategoriesFromIcecat(1);
        console.log(`✅ Normalizzazione completata: ${stats.normalized} prodotti aggiornati su ${stats.total} analizzati.`);
    } catch (error: any) {
        console.error('❌ Errore durante la normalizzazione:', error.message);
    }

    await prisma.$disconnect();
}

runNormalization().catch(console.error);
