import prisma from './src/config/database';

async function checkConfig() {
    console.log('🔍 Verifica configurazione Shopify per SANTE (ID 2)...\n');

    const configs = await prisma.configurazioneSistema.findMany({
        where: {
            utenteId: 2,
            chiave: { contains: 'shopify' }
        }
    });

    if (configs.length > 0) {
        console.log('=== CONFIGURAZIONE SHOPIFY SANTE ===');
        for (const c of configs) {
            // Nasconde token sensibili
            const value = c.chiave.includes('token')
                ? c.valore.substring(0, 20) + '...'
                : c.valore;
            console.log(`${c.chiave}: ${value}`);
        }
    } else {
        console.log('❌ Nessuna configurazione Shopify per utente 2 (SANTE)');
        console.log('   Cercando configurazione globale...');

        const globalConfigs = await prisma.configurazioneSistema.findMany({
            where: {
                chiave: { contains: 'shopify' }
            }
        });

        if (globalConfigs.length > 0) {
            console.log('\n=== CONFIGURAZIONI SHOPIFY TROVATE ===');
            for (const c of globalConfigs) {
                const value = c.chiave.includes('token')
                    ? c.valore.substring(0, 20) + '...'
                    : c.valore;
                console.log(`Utente ${c.utenteId}: ${c.chiave} = ${value}`);
            }
        }
    }

    await prisma.$disconnect();
}
checkConfig();
