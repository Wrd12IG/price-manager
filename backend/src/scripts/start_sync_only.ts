#!/usr/bin/env ts-node
import prisma from '../config/database';
import { ShopifyService } from '../services/ShopifyService';
import { logger } from '../utils/logger';

async function main() {
    const utenti = [
        { id: 2, nome: 'SANTE' },
        { id: 3, nome: 'EUROPC' }
    ];

    console.log('🚀 AVVIO SINCRONIZZAZIONE SHOPIFY (Fix Tabella + Fix EuroPC)\n');

    for (const utente of utenti) {
        try {
            console.log(`\n📦 Utente: ${utente.nome} (ID: ${utente.id})`);
            const pendingCount = await prisma.outputShopify.count({
                where: { utenteId: utente.id, statoCaricamento: 'pending' }
            });

            if (pendingCount === 0) {
                console.log('✅ Nessun prodotto da sincronizzare.');
                continue;
            }

            console.log(`⏳ Sincronizzazione di ${pendingCount} prodotti in corso...`);
            const result = await ShopifyService.syncProducts(utente.id);

            console.log(`✅ Completato ${utente.nome}:`);
            console.log(`   - Successi: ${result.success}`);
            console.log(`   - Errori: ${result.errors}`);
            console.log(`   - Totale: ${result.total}`);
        } catch (error: any) {
            console.error(`❌ Errore sincronizzazione ${utente.nome}:`, error.message);
        }
    }

    console.log('\n🎯 Operazione terminata.');
}

main().then(() => prisma.$disconnect());
