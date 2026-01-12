#!/usr/bin/env ts-node
/**
 * Verifica finale end-to-end di tutte le correzioni
 */

import prisma from '../config/database';
import { ProductFilterService } from '../services/ProductFilterService';

async function finalVerification() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   VERIFICA FINALE SISTEMA - RIEPILOGO COMPLETO');
    console.log('═══════════════════════════════════════════════════════════\n');

    const service = new ProductFilterService();

    // 1. Verifica Regole Attive
    console.log('📋 REGOLE ATTIVE NEL SISTEMA\n');

    const filterRules = await service.getActiveRules();
    console.log(`Regole di filtro: ${filterRules.length}`);
    filterRules.forEach(rule => {
        console.log(`  ✓ ${rule.nome} (${rule.tipoFiltro})`);
        if (rule.brand) console.log(`    Brand: ${rule.brand}`);
        if (rule.categoria) console.log(`    Categoria: ${rule.categoria}`);
    });

    const markupRules = await prisma.regolaMarkup.findMany({
        where: { attiva: true }
    });
    console.log(`\nRegole di markup: ${markupRules.length}`);
    markupRules.forEach(rule => {
        console.log(`  ✓ ${rule.tipoRegola}: ${rule.riferimento || 'default'} (+${rule.markupPercentuale}%)`);
    });

    // 2. Statistiche Database
    console.log('\n-----------------------------------------------------------');
    console.log('📊 STATISTICHE DATABASE\n');

    const stats = {
        total: await prisma.masterFile.count(),
        withPrice: await prisma.masterFile.count({ where: { prezzoVenditaCalcolato: { gt: 0 } } }),
        withoutPrice: await prisma.masterFile.count({ where: { prezzoVenditaCalcolato: { lte: 0 } } }),
        notebooks: await prisma.masterFile.count({ where: { categoriaEcommerce: { contains: 'NOTEBOOK' } } }),
        notebooksWithPrice: await prisma.masterFile.count({
            where: {
                categoriaEcommerce: { contains: 'NOTEBOOK' },
                prezzoVenditaCalcolato: { gt: 0 }
            }
        }),
        outputShopify: await prisma.outputShopify.count(),
        outputPending: await prisma.outputShopify.count({ where: { statoCaricamento: 'pending' } }),
        outputUploaded: await prisma.outputShopify.count({ where: { statoCaricamento: 'uploaded' } })
    };

    console.log('MasterFile:');
    console.log(`  Prodotti totali: ${stats.total}`);
    console.log(`  Con prezzo vendita > 0: ${stats.withPrice} (${((stats.withPrice / stats.total) * 100).toFixed(1)}%)`);
    console.log(`  Con prezzo vendita = 0: ${stats.withoutPrice} (${((stats.withoutPrice / stats.total) * 100).toFixed(1)}%)`);

    console.log('\nNotebook:');
    console.log(`  Totali: ${stats.notebooks}`);
    console.log(`  Con prezzo > 0: ${stats.notebooksWithPrice} (${((stats.notebooksWithPrice / stats.notebooks) * 100).toFixed(1)}%)`);

    console.log('\nOutputShopify:');
    console.log(`  Prodotti preparati: ${stats.outputShopify}`);
    console.log(`  Pending: ${stats.outputPending}`);
    console.log(`  Uploaded: ${stats.outputUploaded}`);

    // 3. Esempi Prodotti
    console.log('\n-----------------------------------------------------------');
    console.log('📦 ESEMPI PRODOTTI\n');

    const exampleNotebooks = await prisma.masterFile.findMany({
        where: {
            categoriaEcommerce: { contains: 'NOTEBOOK' },
            prezzoVenditaCalcolato: { gt: 0 }
        },
        select: {
            marca: true,
            categoriaEcommerce: true,
            prezzoAcquistoMigliore: true,
            prezzoVenditaCalcolato: true,
            regolaMarkupId: true
        },
        take: 3
    });

    console.log('Notebook con prezzo (dovrebbero avere markup +300%):');
    exampleNotebooks.forEach(p => {
        const markup = ((p.prezzoVenditaCalcolato - p.prezzoAcquistoMigliore) / p.prezzoAcquistoMigliore * 100).toFixed(0);
        const hasRule = p.regolaMarkupId ? '✓' : '✗';
        console.log(`  ${hasRule} ${p.marca} - €${p.prezzoAcquistoMigliore} → €${p.prezzoVenditaCalcolato} (+${markup}%)`);
    });

    const exampleNonNotebooks = await prisma.masterFile.findMany({
        where: {
            categoriaEcommerce: { not: { contains: 'NOTEBOOK' } }
        },
        select: {
            marca: true,
            categoriaEcommerce: true,
            prezzoVenditaCalcolato: true
        },
        take: 3
    });

    console.log('\nNon-Notebook (dovrebbero avere prezzo = 0):');
    exampleNonNotebooks.forEach(p => {
        const status = p.prezzoVenditaCalcolato === 0 ? '✓' : '✗';
        console.log(`  ${status} ${p.marca} - ${p.categoriaEcommerce} - €${p.prezzoVenditaCalcolato}`);
    });

    // 4. Verifica Metafield
    console.log('\n-----------------------------------------------------------');
    console.log('🏷️  VERIFICA METAFIELD\n');

    const productWithMetafields = await prisma.outputShopify.findFirst({
        where: {
            metafieldsJson: { not: null }
        },
        select: {
            title: true,
            metafieldsJson: true
        }
    });

    if (productWithMetafields) {
        try {
            const metafields = JSON.parse(productWithMetafields.metafieldsJson!);
            console.log(`Prodotto esempio: ${productWithMetafields.title}`);
            console.log(`Metafield totali: ${metafields.length}`);

            const metafieldTypes = metafields.reduce((acc: any, mf: any) => {
                acc[mf.namespace] = (acc[mf.namespace] || 0) + 1;
                return acc;
            }, {});

            console.log('Distribuzione per namespace:');
            Object.entries(metafieldTypes).forEach(([ns, count]) => {
                console.log(`  ${ns}: ${count} metafield`);
            });
        } catch (e) {
            console.log('⚠️  Errore parsing metafield');
        }
    } else {
        console.log('⚠️  Nessun prodotto con metafield trovato');
        console.log('   Eseguire ShopifyService.prepareExport() per generarli');
    }

    // 5. Riepilogo Finale
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   RIEPILOGO STATO SISTEMA');
    console.log('═══════════════════════════════════════════════════════════\n');

    const checks = {
        filterRulesActive: filterRules.length > 0,
        markupRulesActive: markupRules.length > 0,
        productsWithPrice: stats.withPrice > 0,
        notebooksHavePrice: stats.notebooksWithPrice > 0,
        outputExists: stats.outputShopify > 0
    };

    console.log('✅ Regole di filtro attive:', checks.filterRulesActive ? 'SÌ' : 'NO');
    console.log('✅ Regole di markup attive:', checks.markupRulesActive ? 'SÌ' : 'NO');
    console.log('✅ Prodotti con prezzo calcolato:', checks.productsWithPrice ? 'SÌ' : 'NO');
    console.log('✅ Notebook con prezzo:', checks.notebooksHavePrice ? 'SÌ' : 'NO');
    console.log('✅ Output Shopify preparato:', checks.outputExists ? 'SÌ' : 'NO');

    const allChecks = Object.values(checks).every(v => v);

    console.log('\n' + (allChecks ? '🎉 SISTEMA COMPLETAMENTE FUNZIONANTE!' : '⚠️  Alcuni componenti necessitano attenzione'));

    if (!checks.outputExists) {
        console.log('\n💡 SUGGERIMENTO: Eseguire ShopifyService.prepareExport() per preparare i prodotti');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
}

finalVerification()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Errore:', error);
        process.exit(1);
    });
