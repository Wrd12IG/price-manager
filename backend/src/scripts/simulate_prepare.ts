import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simulatePrepareExport() {
    const ean = '4711387252970';

    try {
        console.log(`=== SIMULATING PREPARE EXPORT FOR ${ean} ===\n`);

        const p = await prisma.masterFile.findUnique({
            where: { eanGtin: ean },
            include: { datiIcecat: true }
        });

        if (!p) {
            console.log('❌ Product not found');
            return;
        }

        console.log(`Found product: ${p.nomeProdotto}`);

        // --- LOGIC FROM ShopifyService.ts ---

        const icecatData = p.datiIcecat;
        let features: any[] = [];
        let specs: any = {};

        if (icecatData?.specificheTecnicheJson) {
            try {
                features = JSON.parse(icecatData.specificheTecnicheJson);

                // Helper per estrarre valore feature
                const getFeatureValue = (namePart: string) => {
                    const f = features.find((f: any) =>
                        f.Feature?.Name?.Value?.toLowerCase().includes(namePart.toLowerCase())
                    );
                    return f ? f.PresentationValue : null;
                };

                specs = {
                    cpu: getFeatureValue('processor family') || getFeatureValue('famiglia processore'),
                    ram: getFeatureValue('internal memory') || getFeatureValue('ram installata'),
                    storage: getFeatureValue('total storage capacity') || getFeatureValue('capacità totale di archiviazione'),
                    display: getFeatureValue('display diagonal') || getFeatureValue('dimensioni schermo'),
                    os: getFeatureValue('operating system installed') || getFeatureValue('sistema operativo incluso'),
                    gpu: getFeatureValue('discrete graphics card model') || getFeatureValue('scheda grafica dedicata'),
                    touch: getFeatureValue('touchscreen')
                };
            } catch (e) {
                console.log('Error parsing specs');
            }
        }

        // Metafields generation
        const metafields: any[] = [];
        const addMetafield = (key: string, value: any, type: string = 'single_line_text_field') => {
            if (value !== null && value !== undefined && value !== '') {
                metafields.push({
                    namespace: 'custom',
                    key: key,
                    value: String(value),
                    type: type
                });
            }
        };

        addMetafield('codice_ean', p.eanGtin, 'single_line_text_field');
        addMetafield('marca_produttore', p.marca, 'single_line_text_field');
        addMetafield('categoria_prodotto', p.categoriaEcommerce, 'single_line_text_field');
        addMetafield('info_disponibilita', p.quantitaTotaleAggregata > 0 ? `${p.quantitaTotaleAggregata} unità` : 'Su ordinazione', 'single_line_text_field');

        if (specs.cpu) addMetafield('spec_cpu', specs.cpu, 'single_line_text_field');
        if (specs.ram) addMetafield('spec_ram', specs.ram, 'single_line_text_field');
        if (specs.storage) addMetafield('spec_storage', specs.storage, 'single_line_text_field');
        if (specs.display) addMetafield('spec_display', specs.display, 'single_line_text_field');
        if (specs.os) addMetafield('spec_os', specs.os, 'single_line_text_field');
        if (specs.gpu) addMetafield('spec_gpu', specs.gpu, 'single_line_text_field');
        if (specs.touch) addMetafield('spec_touch', specs.touch, 'single_line_text_field');

        if (icecatData?.descrizioneBrave) {
            addMetafield('descrizione_breve', icecatData.descrizioneBrave, 'multi_line_text_field');
        }

        // --- END LOGIC ---

        console.log(`\n✅ Generated ${metafields.length} metafields:`);
        metafields.forEach(m => {
            console.log(`  - ${m.namespace}.${m.key}: ${m.value.substring(0, 50)}${m.value.length > 50 ? '...' : ''}`);
        });

        // Save to DB (simulate)
        console.log('\nSaving to OutputShopify...');

        await prisma.outputShopify.upsert({
            where: { masterFileId: p.id },
            create: {
                masterFileId: p.id,
                title: p.nomeProdotto || 'No Title',
                handle: (p.nomeProdotto || 'no-title').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                vendor: p.marca || 'Generic',
                productType: p.categoriaEcommerce || 'Generic',
                variantPrice: p.prezzoVenditaCalcolato || 0,
                variantInventoryQty: p.quantitaTotaleAggregata,
                metafieldsJson: JSON.stringify(metafields),
                statoCaricamento: 'pending',
                bodyHtml: icecatData?.descrizioneLunga || p.nomeProdotto || '',
                immaginiUrls: icecatData?.urlImmaginiJson || '[]',
                tags: [p.marca, p.categoriaEcommerce].filter(Boolean).join(',')
            },
            update: {
                metafieldsJson: JSON.stringify(metafields),
                statoCaricamento: 'pending' // Force re-sync
            }
        });

        console.log('✅ Saved successfully!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

simulatePrepareExport();
