import prisma from '../config/database';
import { logger } from '../utils/logger';
import { ProductFilterService } from '../services/ProductFilterService';
import { IcecatService } from '../services/IcecatService';

/**
 * Script di debug per verificare perché i prodotti Asus non vengono filtrati correttamente
 */
async function debugAsusFilter() {
    console.log('🔍 DEBUG: Analisi filtro prodotti Asus dal listino Cometa\n');

    // 1. Trova il fornitore Cometa
    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Fornitore Cometa non trovato!');
        return;
    }

    console.log(`✅ Fornitore Cometa trovato: ID ${cometa.id} - ${cometa.nomeFornitore}\n`);

    // 2. Verifica mappature per Cometa
    console.log('📋 STEP 1: Verifica Mappature Campi per Cometa');
    console.log('='.repeat(60));
    const mappature = await prisma.mappaturaCampo.findMany({
        where: { fornitoreId: cometa.id }
    });

    if (mappature.length === 0) {
        console.error('❌ PROBLEMA: Nessuna mappatura trovata per Cometa!');
        console.log('   → Questo potrebbe essere il problema principale.\n');
    } else {
        console.log(`✅ Trovate ${mappature.length} mappature:`);
        mappature.forEach(m => {
            console.log(`   - ${m.campoOriginale} → ${m.campoStandard}`);
        });
        console.log();
    }

    // 3. Controlla prodotti raw dal listino Cometa
    console.log('📦 STEP 2: Prodotti RAW dal Listino Cometa');
    console.log('='.repeat(60));

    const rawProducts = await prisma.listinoRaw.findMany({
        where: {
            fornitoreId: cometa.id,
            eanGtin: { not: null }
        },
        take: 100
    });

    console.log(`Totale prodotti con EAN: ${rawProducts.length}`);

    // Filtra prodotti che contengono "asus" nella marca o descrizione
    const asusProducts = rawProducts.filter(p =>
        (p.marca?.toLowerCase().includes('asus')) ||
        (p.descrizioneOriginale?.toLowerCase().includes('asus'))
    );

    console.log(`Prodotti con "Asus" nel campo marca o descrizione: ${asusProducts.length}\n`);

    if (asusProducts.length === 0) {
        console.error('❌ PROBLEMA: Nessun prodotto Asus trovato nel listino raw!');
        console.log('   → Verifica che la mappatura del campo "marca" sia corretta.\n');

        // Mostra esempi di prodotti per capire la struttura
        console.log('📝 Esempi di prodotti (primi 5):');
        rawProducts.slice(0, 5).forEach((p, i) => {
            console.log(`\n   Prodotto ${i + 1}:`);
            console.log(`   - EAN: ${p.eanGtin}`);
            console.log(`   - Marca: ${p.marca || 'N/A'}`);
            console.log(`   - Descrizione: ${p.descrizioneOriginale?.substring(0, 80)}...`);
            console.log(`   - Categoria: ${p.categoriaFornitore || 'N/A'}`);
        });
    } else {
        console.log('✅ Esempi prodotti Asus trovati (primi 5):');
        asusProducts.slice(0, 5).forEach((p, i) => {
            console.log(`\n   Prodotto ${i + 1}:`);
            console.log(`   - EAN: ${p.eanGtin}`);
            console.log(`   - Marca: ${p.marca || 'N/A'}`);
            console.log(`   - Descrizione: ${p.descrizioneOriginale?.substring(0, 80)}...`);
            console.log(`   - Categoria: ${p.categoriaFornitore || 'N/A'}`);
            console.log(`   - Prezzo: €${p.prezzoAcquisto}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔍 STEP 3: Verifica Consolidamento MasterFile');
    console.log('='.repeat(60));

    // 4. Verifica prodotti Asus nel MasterFile
    const masterAsus = await prisma.masterFile.findMany({
        where: {
            marca: { contains: 'ASUS' }
        },
        include: {
            fornitoreSelezionato: true,
            datiIcecat: {
                select: {
                    specificheTecnicheJson: true,
                    descrizioneBrave: true
                }
            }
        }
    });

    console.log(`Prodotti Asus nel MasterFile: ${masterAsus.length}\n`);

    if (masterAsus.length === 0) {
        console.error('❌ PROBLEMA: Nessun prodotto Asus nel MasterFile!');
        console.log('   → I prodotti Asus potrebbero essere stati filtrati durante il consolidamento.\n');
    } else {
        console.log('✅ Esempi prodotti Asus nel MasterFile (primi 5):');
        masterAsus.slice(0, 5).forEach((p, i) => {
            console.log(`\n   Prodotto ${i + 1}:`);
            console.log(`   - EAN: ${p.eanGtin}`);
            console.log(`   - Marca (campo): ${p.marca || 'N/A'}`);
            console.log(`   - Nome: ${p.nomeProdotto?.substring(0, 60)}...`);
            console.log(`   - Fornitore: ${p.fornitoreSelezionato?.nomeFornitore}`);
            console.log(`   - Categoria: ${p.categoriaEcommerce || 'N/A'}`);

            // Verifica brand da Icecat
            if (p.datiIcecat?.specificheTecnicheJson) {
                try {
                    const specs = JSON.parse(p.datiIcecat.specificheTecnicheJson);
                    const icecatBrand = IcecatService.extractBrandFromFeatures(specs);
                    console.log(`   - Marca (Icecat): ${icecatBrand || 'N/A'}`);
                } catch (e) {
                    console.log(`   - Marca (Icecat): Errore parsing`);
                }
            }
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 STEP 4: Verifica Regole di Filtro Attive');
    console.log('='.repeat(60));

    const filterService = new ProductFilterService();
    const activeRules = await filterService.getActiveRules();

    console.log(`Regole di filtro attive: ${activeRules.length}\n`);

    if (activeRules.length === 0) {
        console.log('⚠️  Nessuna regola di filtro attiva.');
        console.log('   → Se non ci sono regole, tutti i prodotti dovrebbero essere inclusi.\n');
    } else {
        console.log('Regole attive:');
        activeRules.forEach((rule, i) => {
            console.log(`\n   ${i + 1}. ${rule.nome}`);
            console.log(`      - Tipo: ${rule.tipoFiltro}`);
            console.log(`      - Azione: ${rule.azione}`);
            console.log(`      - Brand: ${rule.brand || 'N/A'}`);
            console.log(`      - Categoria: ${rule.categoria || 'N/A'}`);
            console.log(`      - Priorità: ${rule.priorita}`);
        });
    }

    // 5. Test del filtro su un prodotto Asus
    if (masterAsus.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 STEP 5: Test Filtro su Prodotto Asus');
        console.log('='.repeat(60));

        const testProduct = masterAsus[0];
        let testBrand = testProduct.marca;

        // Se il brand non è nel campo marca, prova da Icecat
        if (!testBrand && testProduct.datiIcecat?.specificheTecnicheJson) {
            try {
                const specs = JSON.parse(testProduct.datiIcecat.specificheTecnicheJson);
                testBrand = IcecatService.extractBrandFromFeatures(specs);
            } catch (e) {
                // ignore
            }
        }

        console.log(`\nTest su prodotto: ${testProduct.nomeProdotto?.substring(0, 60)}...`);
        console.log(`Brand usato per il test: ${testBrand || 'N/A'}`);
        console.log(`Categoria: ${testProduct.categoriaEcommerce || 'N/A'}\n`);

        const filterResult = await filterService.shouldIncludeProduct(
            testBrand,
            testProduct.categoriaEcommerce
        );

        console.log('Risultato filtro:');
        console.log(`   - Incluso: ${filterResult.shouldInclude ? '✅ SÌ' : '❌ NO'}`);
        console.log(`   - Motivo: ${filterResult.reason}`);
        if (filterResult.matchedRules) {
            console.log(`   - Regole matchate: ${filterResult.matchedRules.join(', ')}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO DIAGNOSI');
    console.log('='.repeat(60));

    const issues: string[] = [];

    if (mappature.length === 0) {
        issues.push('❌ Nessuna mappatura configurata per Cometa');
    }

    if (asusProducts.length === 0) {
        issues.push('❌ Nessun prodotto Asus trovato nel listino raw (problema mappatura campo marca?)');
    }

    if (masterAsus.length === 0 && asusProducts.length > 0) {
        issues.push('❌ Prodotti Asus presenti nel raw ma assenti nel MasterFile (problema consolidamento?)');
    }

    if (issues.length > 0) {
        console.log('\n🚨 PROBLEMI RILEVATI:\n');
        issues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
    } else {
        console.log('\n✅ Nessun problema evidente rilevato nella pipeline.');
        console.log('   Il problema potrebbe essere nelle regole di filtro o nella logica di matching.');
    }

    console.log('\n' + '='.repeat(60));
}

// Esegui lo script
debugAsusFilter()
    .catch(error => {
        console.error('❌ Errore durante il debug:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
