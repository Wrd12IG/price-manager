import prisma from '../config/database';
import { logger } from '../utils/logger';

/**
 * Script per verificare quali metafields sono salvati nel database
 * e quali vengono generati durante prepareExport
 */
async function checkMetafields() {
    try {
        console.log('=== VERIFICA METAFIELDS ===\n');

        // 1. Prendi un prodotto di esempio dall'OutputShopify
        const sampleOutput = await prisma.outputShopify.findFirst({
            where: {
                metafieldsJson: { not: null }
            },
            include: {
                masterFile: {
                    include: {
                        datiIcecat: true
                    }
                }
            }
        });

        if (!sampleOutput) {
            console.log('❌ Nessun prodotto trovato in OutputShopify con metafields');
            return;
        }

        console.log(`📦 Prodotto: ${sampleOutput.title}`);
        console.log(`🔖 Handle: ${sampleOutput.handle}`);
        console.log(`🏷️  EAN: ${sampleOutput.masterFile?.eanGtin}\n`);

        // 2. Parse e mostra i metafields salvati
        if (sampleOutput.metafieldsJson) {
            try {
                const metafields = JSON.parse(sampleOutput.metafieldsJson);
                console.log(`📊 METAFIELDS SALVATI NEL DATABASE (${metafields.length} totali):\n`);

                metafields.forEach((mf: any, index: number) => {
                    console.log(`${index + 1}. ${mf.namespace}.${mf.key}`);
                    console.log(`   Type: ${mf.type}`);
                    console.log(`   Value: ${mf.value.substring(0, 100)}${mf.value.length > 100 ? '...' : ''}`);
                    console.log('');
                });

                // 3. Raggruppa per namespace
                const byNamespace = metafields.reduce((acc: any, mf: any) => {
                    if (!acc[mf.namespace]) acc[mf.namespace] = [];
                    acc[mf.namespace].push(mf.key);
                    return acc;
                }, {});

                console.log('\n📋 RIEPILOGO PER NAMESPACE:');
                Object.keys(byNamespace).forEach(ns => {
                    console.log(`\n${ns}:`);
                    byNamespace[ns].forEach((key: string) => {
                        console.log(`  - ${key}`);
                    });
                });

            } catch (e) {
                console.error('❌ Errore parsing metafieldsJson:', e);
            }
        } else {
            console.log('⚠️  Nessun metafield salvato per questo prodotto');
        }

        // 4. Verifica dati Icecat disponibili
        console.log('\n\n=== DATI ICECAT DISPONIBILI ===\n');
        const icecat = sampleOutput.masterFile?.datiIcecat;

        if (icecat) {
            console.log(`✅ Descrizione Breve: ${icecat.descrizioneBrave ? 'SÌ' : 'NO'}`);
            console.log(`✅ Descrizione Lunga: ${icecat.descrizioneLunga ? 'SÌ' : 'NO'}`);
            console.log(`✅ Specifiche Tecniche: ${icecat.specificheTecnicheJson ? 'SÌ' : 'NO'}`);
            console.log(`✅ Bullet Points: ${icecat.bulletPointsJson ? 'SÌ' : 'NO'}`);
            console.log(`✅ Documenti: ${icecat.documentiJson ? 'SÌ' : 'NO'}`);
            console.log(`✅ Immagini: ${icecat.urlImmaginiJson ? 'SÌ' : 'NO'}`);

            // Mostra alcune specifiche se disponibili
            if (icecat.specificheTecnicheJson) {
                try {
                    const specs = JSON.parse(icecat.specificheTecnicheJson);
                    const features = Array.isArray(specs) ? specs : (specs.features || []);
                    console.log(`\n📊 Specifiche Tecniche disponibili: ${features.length}`);

                    if (features.length > 0) {
                        console.log('\nPrime 10 specifiche:');
                        features.slice(0, 10).forEach((f: any, i: number) => {
                            const name = f.Feature?.Name?.Value || 'N/A';
                            const value = f.PresentationValue || 'N/A';
                            console.log(`  ${i + 1}. ${name}: ${value}`);
                        });
                    }
                } catch (e) {
                    console.error('❌ Errore parsing specifiche:', e);
                }
            }
        } else {
            console.log('❌ Nessun dato Icecat disponibile per questo prodotto');
        }

        // 5. Conta totale prodotti e metafields
        console.log('\n\n=== STATISTICHE GENERALI ===\n');

        const totalProducts = await prisma.outputShopify.count();
        const productsWithMetafields = await prisma.outputShopify.count({
            where: { metafieldsJson: { not: null } }
        });

        console.log(`📦 Prodotti totali in OutputShopify: ${totalProducts}`);
        console.log(`🏷️  Prodotti con metafields: ${productsWithMetafields}`);
        console.log(`📊 Percentuale: ${((productsWithMetafields / totalProducts) * 100).toFixed(1)}%`);

        // 6. Analizza quanti metafields in media
        const allOutputs = await prisma.outputShopify.findMany({
            where: { metafieldsJson: { not: null } },
            select: { metafieldsJson: true }
        });

        let totalMetafields = 0;
        let metafieldCounts: { [key: string]: number } = {};

        allOutputs.forEach(output => {
            try {
                const mfs = JSON.parse(output.metafieldsJson!);
                totalMetafields += mfs.length;

                mfs.forEach((mf: any) => {
                    const key = `${mf.namespace}.${mf.key}`;
                    metafieldCounts[key] = (metafieldCounts[key] || 0) + 1;
                });
            } catch (e) {
                // Skip
            }
        });

        const avgMetafields = totalMetafields / productsWithMetafields;
        console.log(`\n📊 Media metafields per prodotto: ${avgMetafields.toFixed(1)}`);

        console.log('\n🔝 TOP 20 METAFIELDS PIÙ COMUNI:');
        const sorted = Object.entries(metafieldCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);

        sorted.forEach(([key, count], index) => {
            const percentage = ((count / productsWithMetafields) * 100).toFixed(1);
            console.log(`${index + 1}. ${key}: ${count} prodotti (${percentage}%)`);
        });

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMetafields();
