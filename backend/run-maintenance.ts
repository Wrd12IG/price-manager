import { DatabaseCleanupService } from './src/services/DatabaseCleanupService';
import { MasterFileService } from './src/services/MasterFileService';
import { logger } from './src/utils/logger';

async function runMaintenance() {
    try {
        console.log('🚀 Avvio manutenzione database...');

        // 1. Pulizia Marchi (Unificazione duplicati AI)
        console.log('📍 Fase 1: Pulizia Marchi...');
        const brandStats = await DatabaseCleanupService.cleanupBrands();
        console.log(`✅ Pulizia Marchi completata: ${brandStats.merged} marchi unificati.`);

        // 2. Ricalcolo Master File (con nuova logica Hybrid ID e filtri qualità)
        console.log('📍 Fase 2: Ricalcolo Master File...');
        const masterStats = await MasterFileService.consolidaMasterFile();
        console.log(`✅ Master File aggiornato: ${masterStats.consolidated} prodotti totali.`);

        console.log('✨ Manutenzione completata con successo!');
    } catch (error) {
        console.error('❌ Errore durante la manutenzione:', error);
    }
}

runMaintenance();
