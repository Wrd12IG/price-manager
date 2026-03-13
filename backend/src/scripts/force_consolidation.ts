import { MasterFileService } from '../services/MasterFileService';
import { logger } from '../utils/logger';
import prisma from '../config/database';

async function forceConsolidation() {
    console.log('🔄 Avvio consolidamento forzato...');
    try {
        // Verifica filtri attivi
        const activeFilters = await prisma.productFilterRule.count({ where: { attiva: true } });
        console.log(`🔍 Filtri attivi nel DB: ${activeFilters}`);

        const user = await prisma.utente.findFirst();
        if (!user) throw new Error('User not found');

        const result = await MasterFileService.consolidaMasterFile(user.id);
        console.log('\n✅ Consolidamento completato!');
        console.log(`📊 Totale Raw: ${result.totalRaw}`);
        console.log(`🔍 Filtrati: ${result.filtered}`);
        console.log(`🔄 Consolidati: ${result.consolidated}`);

        // Verifica finale conteggio
        const count = await prisma.masterFile.count();
        console.log(`\n📈 Totale prodotti nel MasterFile ora: ${count}`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

forceConsolidation();
