#!/usr/bin/env tsx
import prisma from '../config/database';

async function checkProductMetafields() {
    const ean = '4711081786733';

    console.log(`\n🔍 Ricerca prodotto con EAN: ${ean}\n`);

    try {
        // Test connessione database
        console.log('Connessione al database...');
        await prisma.$connect();
        console.log('✅ Database connesso\n');

        // Trova il prodotto nel MasterFile
        console.log('Ricerca nel MasterFile...');
        const product = await prisma.masterFile.findFirst({
            where: { eanGtin: ean },
            include: {
                datiIcecat: true,
                outputShopify: true
            }
        });

        if (!product) {
            console.log('❌ Prodotto non trovato nel MasterFile');
            await prisma.$disconnect();
            return;
        }

        console.log('✅ Prodotto trovato nel MasterFile:');
        console.log(`   ID: ${product.id}`);
        console.log(`   Nome: ${product.nomeProdotto}`);
        console.log(`   Marca: ${product.marca}`);
        console.log(`   Categoria: ${product.categoriaEcommerce}`);
        console.log(`   Prezzo: €${product.prezzoVenditaCalcolato}`);
        console.log(`   Ha Icecat: ${product.datiIcecat ? '✅' : '❌'}`);
        console.log(`   Ha OutputShopify: ${product.outputShopify ? '✅' : '❌'}`);

        if (product.datiIcecat) {
            console.log('\n📦 Dati Icecat:');
            console.log(`   Descrizione Breve: ${product.datiIcecat.descrizioneBrave?.substring(0, 80) || 'N/A'}...`);
            console.log(`   Descrizione Lunga: ${product.datiIcecat.descrizioneLunga ? 'Presente (' + product.datiIcecat.descrizioneLunga.length + ' caratteri)' : 'Assente'}`);

            if (product.datiIcecat.bulletPointsJson) {
                try {
                    const bullets = JSON.parse(product.datiIcecat.bulletPointsJson);
                    console.log(`   Bullet Points: ${bullets.length}`);
                } catch (e) {
                    console.log(`   Bullet Points: Errore parsing`);
                }
            }

            if (product.datiIcecat.urlImmaginiJson) {
                try {
                    const images = JSON.parse(product.datiIcecat.urlImmaginiJson);
                    console.log(`   Immagini: ${images.length}`);
                } catch (e) {
                    console.log(`   Immagini: Errore parsing`);
                }
            }
        }

        if (product.outputShopify) {
            console.log('\n📤 OutputShopify:');
            console.log(`   ID: ${product.outputShopify.id}`);
            console.log(`   Handle: ${product.outputShopify.handle}`);
            console.log(`   Title: ${product.outputShopify.title}`);
            console.log(`   Stato: ${product.outputShopify.statoCaricamento}`);
            console.log(`   Shopify Product ID: ${product.outputShopify.shopifyProductId || 'Non ancora caricato'}`);

            // Parse e mostra metafields
            if (product.outputShopify.metafieldsJson) {
                try {
                    const metafields = JSON.parse(product.outputShopify.metafieldsJson);

                    console.log(`\n🏷️  METAFIELDS (${metafields.length} totali):\n`);

                    // Lista completa delle chiavi
                    console.log('📋 Lista completa chiavi metafield:');
                    metafields.forEach((m: any, i: number) => {
                        console.log(`   ${(i + 1).toString().padStart(2, ' ')}. ${m.namespace}.${m.key}`);
                    });

                    console.log('\n📝 Dettaglio metafields:\n');

                    // Mostra dettagli
                    metafields.forEach((field: any) => {
                        const valuePreview = field.value.length > 150
                            ? field.value.substring(0, 150) + '...'
                            : field.value;
                        console.log(`   • ${field.namespace}.${field.key}`);
                        console.log(`     Tipo: ${field.type}`);
                        console.log(`     Valore: ${valuePreview}`);
                        console.log('');
                    });

                } catch (e: any) {
                    console.log('❌ Errore parsing metafieldsJson:', e.message);
                }
            } else {
                console.log('\n⚠️  Nessun metafield trovato in OutputShopify');
            }

            // Mostra anche specificheJson
            if (product.outputShopify.specificheJson) {
                try {
                    const specs = JSON.parse(product.outputShopify.specificheJson);
                    console.log('\n🔧 Specifiche estratte:');
                    Object.entries(specs).forEach(([key, value]) => {
                        console.log(`   • ${key}: ${value}`);
                    });
                } catch (e) {
                    console.log('❌ Errore parsing specificheJson');
                }
            }
        } else {
            console.log('\n⚠️  Prodotto non ancora preparato per Shopify');
            console.log('   Esegui prima: POST /api/shopify/prepare');
        }

    } catch (error: any) {
        console.error('\n❌ Errore:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
        console.log('\n✅ Disconnesso dal database');
    }
}

checkProductMetafields().catch(console.error);
