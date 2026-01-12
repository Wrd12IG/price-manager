
import prisma from '../config/database';
import { MarkupService } from '../services/MarkupService';
import { ShopifyService } from '../services/ShopifyService';

async function fixAndRun() {
    console.log('🔧 FIX CONFIGURAZIONE E AVVIO AGGIORNAMENTO\n');

    try {
        // 1. FIX REGOLE MARKUP
        console.log('1️⃣  Verifica Regole Markup...');
        const markupRule = await prisma.regolaMarkup.findFirst({
            where: {
                tipoRegola: 'categoria',
                riferimento: { contains: 'NOTEBOOK' } // Rimosso mode: insensitive per SQLite
            }
        });

        if (markupRule) {
            console.log(`   Trovata regola esistente: ${markupRule.riferimento} (Attiva: ${markupRule.attiva})`);
            if (!markupRule.attiva) {
                await prisma.regolaMarkup.update({
                    where: { id: markupRule.id },
                    data: { attiva: true }
                });
                console.log('   ✅ Regola attivata!');
            }
        } else {
            console.log('   ⚠️ Nessuna regola trovata. Creazione nuova regola...');
            await prisma.regolaMarkup.create({
                data: {
                    // nome: 'Markup Notebook', // Campo non esistente
                    tipoRegola: 'categoria',
                    riferimento: 'NOTEBOOK',
                    markupPercentuale: 300,
                    markupFisso: 0,
                    costoSpedizione: 0,
                    priorita: 10,
                    attiva: true
                }
            });
            console.log('   ✅ Nuova regola creata (+300%)');
        }

        // 2. FIX REGOLE FILTRO
        console.log('\n2️⃣  Verifica Regole Filtro...');
        const filterRule = await prisma.productFilterRule.findFirst({
            where: {
                tipoFiltro: 'category',
                categoria: { contains: 'NOTEBOOK' }
            }
        });

        if (filterRule) {
            console.log(`   Trovata regola filtro: ${filterRule.categoria} (Attiva: ${filterRule.attiva})`);
            if (!filterRule.attiva) {
                await prisma.productFilterRule.update({
                    where: { id: filterRule.id },
                    data: { attiva: true }
                });
                console.log('   ✅ Regola filtro attivata!');
            }
        } else {
            console.log('   ⚠️ Nessuna regola filtro trovata. Creazione...');
            await prisma.productFilterRule.create({
                data: {
                    nome: 'Solo Notebook',
                    tipoFiltro: 'category',
                    categoria: 'NOTEBOOK',
                    azione: 'include',
                    priorita: 1,
                    attiva: true
                }
            });
            console.log('   ✅ Regola filtro creata (Solo Notebook)');
        }

        // 3. ESECUZIONE PROCESSO
        console.log('\n3️⃣  Avvio Ricalcolo e Export...');

        // Ricalcolo Prezzi
        const markupResult = await MarkupService.applicaRegolePrezzi();
        console.log(`   ✅ Prezzi aggiornati: ${markupResult.updated} (Esclusi: ${markupResult.skippedByFilter})`);

        // Preparazione Export
        console.log('   ⏳ Preparazione Export Shopify (potrebbe richiedere tempo)...');
        await ShopifyService.prepareExport();
        console.log('   ✅ Export preparato');

        // 4. VERIFICA FINALE
        console.log('\n4️⃣  Verifica Risultati...');

        const notebooks = await prisma.masterFile.count({
            where: {
                categoriaEcommerce: { contains: 'NOTEBOOK' },
                prezzoVenditaCalcolato: { gt: 0 }
            }
        });

        const outputMetafields = await prisma.outputShopify.count({
            where: { metafieldsJson: { not: null } }
        });

        console.log(`   Notebook con prezzo: ${notebooks}`);
        console.log(`   Prodotti con metafields: ${outputMetafields}`);

    } catch (error) {
        console.error('❌ ERRORE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixAndRun();
