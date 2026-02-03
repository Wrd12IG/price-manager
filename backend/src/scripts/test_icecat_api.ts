import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import xml2js from 'xml2js';
import CryptoJS from 'crypto-js';

const prisma = new PrismaClient();

async function testIcecatApi() {
    try {
        console.log('\n🧪 ===== TEST API ICECAT =====\n');

        const utenteId = 3;

        // Ottieni credenziali
        const configs = await prisma.configurazioneSistema.findMany({
            where: { utenteId, chiave: { in: ['icecat_username', 'icecat_password'] } }
        });

        const username = configs.find(c => c.chiave === 'icecat_username')?.valore;
        const encryptedPass = configs.find(c => c.chiave === 'icecat_password')?.valore;

        if (!username || !encryptedPass) {
            console.log('❌ Credenziali ICECAT non trovate!');
            return;
        }

        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        const password = CryptoJS.AES.decrypt(encryptedPass, encryptionKey).toString(CryptoJS.enc.Utf8);

        console.log(`👤 Username ICECAT: ${username}`);
        console.log(`🔐 Password decriptata: ${password ? '✅ OK' : '❌ Errore'}\n`);

        // Prendi alcuni EAN da testare
        const testProducts = await prisma.masterFile.findMany({
            where: { utenteId },
            take: 3,
            select: { eanGtin: true, nomeProdotto: true, partNumber: true }
        });

        const baseUrl = 'https://data.icecat.biz/xml_s3/xml_server3.cgi';

        for (const product of testProducts) {
            console.log(`\n🔍 TEST: ${product.nomeProdotto}`);
            console.log(`   EAN: ${product.eanGtin}`);
            console.log(`   PartNumber: ${product.partNumber || 'N/A'}`);

            // Test con EAN
            const url = `${baseUrl}?ean_upc=${product.eanGtin}&lang=it&output_product_xml=1`;

            try {
                const response = await axios.get(url, {
                    auth: { username, password },
                    timeout: 15000
                });

                console.log(`   📡 Status HTTP: ${response.status}`);

                const parser = new xml2js.Parser({ explicitArray: false });
                const result = await parser.parseStringPromise(response.data);

                const icecatResponse = result['ICECAT-interface'];
                const productData = icecatResponse?.Product;

                if (productData) {
                    const attrs = productData.$ || productData || {};

                    if (attrs.ErrorMessage) {
                        console.log(`   ❌ Errore ICECAT: ${attrs.ErrorMessage}`);
                    } else {
                        console.log(`   ✅ Prodotto trovato!`);
                        console.log(`   📷 HighPic: ${attrs.HighPic ? 'Sì' : 'No'}`);

                        if (attrs.HighPic) {
                            console.log(`      URL: ${attrs.HighPic.substring(0, 60)}...`);
                        }

                        // Gallery
                        if (productData.ProductGallery?.ProductPicture) {
                            const pics = Array.isArray(productData.ProductGallery.ProductPicture)
                                ? productData.ProductGallery.ProductPicture
                                : [productData.ProductGallery.ProductPicture];
                            console.log(`   🖼️ Gallery: ${pics.length} immagini`);
                        }

                        // Summary Description
                        if (productData.SummaryDescription) {
                            const short = productData.SummaryDescription.ShortSummaryDescription;
                            if (short) {
                                const text = typeof short === 'string' ? short : (short._ || short.$?.Value || '');
                                console.log(`   📝 Descrizione: ${text.substring(0, 80)}...`);
                            }
                        }
                    }
                } else {
                    console.log(`   ⚠️ Nessun prodotto nella risposta`);

                    // Mostra la risposta per debug
                    if (icecatResponse) {
                        console.log(`   Risposta: ${JSON.stringify(icecatResponse).substring(0, 200)}...`);
                    }
                }

            } catch (error: any) {
                console.log(`   ❌ Errore chiamata: ${error.message}`);
                if (error.response) {
                    console.log(`   HTTP Status: ${error.response.status}`);
                }
            }

            // Delay tra richieste
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('\n✅ Test completato!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testIcecatApi();
