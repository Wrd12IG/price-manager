import prisma from './src/config/database';

/**
 * Monitora in tempo reale lo stato dell'export Shopify per Sante
 */

const SANTE_USER_ID = 2;

async function monitorExportProgress() {
    console.log('🔍 Monitoraggio Export Shopify per Sante...\n');

    try {
        const interval = setInterval(async () => {
            const totalMasterFile = await prisma.masterFile.count({
                where: { utenteId: SANTE_USER_ID }
            });

            const outputShopify = await prisma.outputShopify.count({
                where: { utenteId: SANTE_USER_ID }
            });

            const withMetafields = await prisma.outputShopify.count({
                where: {
                    utenteId: SANTE_USER_ID,
                    metafieldsJson: { not: null }
                }
            });

            const pending = await prisma.outputShopify.count({
                where: {
                    utenteId: SANTE_USER_ID,
                    statoCaricamento: 'pending'
                }
            });

            const uploaded = await prisma.outputShopify.count({
                where: {
                    utenteId: SANTE_USER_ID,
                    statoCaricamento: 'uploaded'
                }
            });

            const errors = await prisma.outputShopify.count({
                where: {
                    utenteId: SANTE_USER_ID,
                    statoCaricamento: 'error'
                }
            });

            const now = new Date().toLocaleTimeString('it-IT');

            console.clear();
            console.log('=' .repeat(60));
            console.log(`📊 STATO EXPORT SHOPIFY - ${now}`);
            console.log('=' .repeat(60));
            console.log(`Utente: Sante (ID: ${SANTE_USER_ID})`);
            console.log('');
            console.log(`📦 Prodotti totali:        ${totalMasterFile}`);
            console.log(`🔧 Record OutputShopify:   ${outputShopify}`);
            console.log(`🏷️  Con metafields:         ${withMetafields}`);
            console.log('');
            console.log('Stati:');
            console.log(`  ⏳ Pending:   ${pending}`);
            console.log(`  ✅ Uploaded:  ${uploaded}`);
            console.log(`  ❌ Errori:    ${errors}`);
            console.log('');
            
            const progress = totalMasterFile > 0 
                ? Math.round((outputShopify / totalMasterFile) * 100) 
                : 0;
            
            const metaProgress = outputShopify > 0 
                ? Math.round((withMetafields / outputShopify) * 100) 
                : 0;

            console.log(`📈 Progresso creazione:    ${progress}% (${outputShopify}/${totalMasterFile})`);
            console.log(`🏷️  Progresso metafields:   ${metaProgress}% (${withMetafields}/${outputShopify})`);
            console.log('');

            // Se completato, mostra messaggio e ferma
            if (outputShopify >= totalMasterFile && withMetafields > 0) {
                console.log('✅ EXPORT COMPLETATO!');
                console.log('');
                console.log('📍 Prossimi passi:');
                console.log('   1. Verifica i metafields generati');
                console.log('   2. Sincronizza con Shopify');
                console.log('   3. Controlla su Shopify Admin');
                console.log('');
                
                clearInterval(interval);
                await prisma.$disconnect();
                process.exit(0);
            }

            console.log('🔄 Aggiornamento ogni 5 secondi... (CTRL+C per uscire)');
            console.log('=' .repeat(60));

        }, 5000);

        // Primo run immediato
        await new Promise(r => setTimeout(r, 100));

    } catch (error: any) {
        console.error('❌ Errore:', error.message);
        await prisma.$disconnect();
        process.exit(1);
    }
}

monitorExportProgress();
