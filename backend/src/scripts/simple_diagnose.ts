
import prisma from '../config/database';

async function diagnose() {
    try {
        console.log('🔍 DIAGNOSTICA SISTEMA\n');

        // 1. Verifica Metafields in OutputShopify
        const outputCount = await prisma.outputShopify.count();
        const outputWithMetafields = await prisma.outputShopify.count({
            where: { metafieldsJson: { not: null } }
        });

        console.log('📦 OutputShopify:');
        console.log('  Totale record:', outputCount);
        console.log('  Con metafields:', outputWithMetafields);

        if (outputWithMetafields > 0) {
            const sample = await prisma.outputShopify.findFirst({
                where: { metafieldsJson: { not: null } },
                select: { title: true, metafieldsJson: true }
            });
            console.log('  Esempio metafields:', sample?.title);
            console.log('  Contenuto (primi 100 char):', sample?.metafieldsJson?.substring(0, 100));
        } else {
            console.log('  ⚠️ NESSUN METAFIELD TROVATO! Eseguire prepareExport()');
        }

        // 2. Verifica Regole Markup
        const markupRules = await prisma.regolaMarkup.findMany({
            where: { attiva: true }
        });

        console.log('\n💰 Regole Markup Attive:', markupRules.length);
        markupRules.forEach(r => {
            console.log(`  - ${r.tipoRegola} (${r.riferimento || 'default'}): +${r.markupPercentuale}%`);
        });

        // 3. Verifica Filtri
        const filterRules = await prisma.productFilterRule.findMany({
            where: { attiva: true }
        });
        console.log('\n📋 Regole Filtro Attive:', filterRules.length);
        filterRules.forEach(r => {
            console.log(`  - ${r.nome} (${r.tipoFiltro}): ${r.brand || r.categoria}`);
        });

    } catch (error) {
        console.error('Errore diagnostica:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
