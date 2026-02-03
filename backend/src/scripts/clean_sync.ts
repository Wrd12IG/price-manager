#!/usr/bin/env ts-node
import prisma from '../config/database';
import { ShopifyExportService } from '../services/ShopifyExportService';
import { ShopifyService } from '../services/ShopifyService';
import { logger } from '../utils/logger';

async function main() {
    const utenti = [
        { id: 2, nome: 'SANTE' },
        { id: 3, nome: 'EUROPC' }
    ];

    console.log('🧹 PULIZIA E RIGENERAZIONE DATI (Fix Tabella + Fix EuroPC)\n');

    for (const utente of utenti) {
        console.log(`\n📦 Utente: ${utente.nome} (ID: ${utente.id})`);

        // 1. Pulizia
        const deleted = await prisma.outputShopify.deleteMany({
            where: { utenteId: utente.id }
        });
        console.log(`   🗑️ Eliminati ${deleted.count} record esistenti.`);

        // 2. Rigenerazione
        console.log(`   ⚙️ Rigenerazione dati export in corso...`);
        const exported = await ShopifyExportService.generateExport(utente.id);
        console.log(`   ✅ Generati ${exported.length} nuovi record.`);

        // 3. Sincronizzazione
        if (exported.length > 0) {
            console.log(`   🚀 Avvio sincronizzazione Shopify...`);
            // Nota: syncProducts chiama internamente generateExport, ma poichè li abbiamo appena creati, salterà la creazione
            const result = await ShopifyService.syncProducts(utente.id);
            console.log(`   ✅ Sincronizzazione completata:`);
            console.log(`      - Successi: ${result.success}`);
            console.log(`      - Errori: ${result.errors}`);
            console.log(`      - Totale: ${result.total}`);
        }
    }

    console.log('\n🎯 Operazione completata con successo.');
}

main().catch(err => console.error('❌ ERRORE:', err)).finally(() => prisma.$disconnect());
