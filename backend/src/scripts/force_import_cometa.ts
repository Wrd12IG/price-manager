import prisma from '../config/database';
import { ImportService } from '../services/ImportService';
import { logger } from '../utils/logger';

async function forceImportCometa() {
    console.log('🚀 Avvio importazione forzata Cometa...');

    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Cometa non trovato');
        return;
    }

    console.log(`Fornitore ID: ${cometa.id}`);

    try {
        const result = await ImportService.importaListino(cometa.id);
        console.log('✅ Importazione completata:', result);
    } catch (error) {
        console.error('❌ Errore importazione:', error);
    }
}

forceImportCometa()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
