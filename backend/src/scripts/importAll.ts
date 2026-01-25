/**
 * Script per importare tutti i listini attivi
 * Usato dal workflow automatico giornaliero
 */

import { ImportService } from '../services/ImportService';
import prisma from '../config/database';
import { logger } from '../utils/logger';

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   IMPORTAZIONE LISTINI - Script Automatico');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        // Importa tutti i listini attivi
        console.log('\n📥 Avvio importazione massiva...');
        const result = await ImportService.importAllListini();

        console.log('\n✅ Importazione completata!');
        console.log(`   Totale processati: ${result.totale}`);
        console.log(`   Successi: ${result.successi}`);
        console.log(`   Errori: ${result.errori}`);

    } catch (error: any) {
        console.error('❌ Errore durante importazione:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
