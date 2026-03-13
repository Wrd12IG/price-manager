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
        // Importa tutti i listini attivi del primo utente trovato (tipicamente l'admin)
        const user = await prisma.utente.findFirst();
        if (!user) {
            throw new Error('Nessun utente trovato nel database');
        }

        console.log(`\n📥 Avvio importazione massiva per utente: ${user.email} (ID: ${user.id})...`);
        const result = await ImportService.importAllListini(user.id);

        console.log('\n✅ Importazione completata!');
        console.log(`\n✅ Importazione completata!`);
        console.log(`   Fornitori processati: ${result.results.length}`);
        console.log(`   Successi: ${result.results.filter(r => r.success).length}`);
        console.log(`   Errori: ${result.totalErrors}`);

        if (result.totalErrors > 0) {
            console.log('\n⚠️ Dettaglio Errori:');
            result.results.filter(r => !r.success).forEach(r => {
                console.log(`   - ${r.fornitore}: ${r.error}`);
            });
        }

    } catch (error: any) {
        console.error('❌ Errore durante importazione:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
