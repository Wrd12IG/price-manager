import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import xml2js from 'xml2js';
import CryptoJS from 'crypto-js';

const prisma = new PrismaClient();

async function reEnrichIcecatData() {
    try {
        console.log('\n🔄 ===== RE-ARRICCHIMENTO ICECAT - EUROPC =====\n');

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

        console.log(`👤 Username: ${username}`);

        // Trova i prodotti con record ICECAT vuoti
        const productsToEnrich = await prisma.datiIcecat.findMany({
            where: {
                masterFile: { utenteId },
                OR: [
                    { urlImmaginiJson: '[]' },
                    { urlImmaginiJson: null },
                    { specificheTecnicheJson: '[]' },
                    { specificheTecnicheJson: null }
                ]
            },
            include: {
                masterFile: {
                    include: { marchio: true }
                }
            }
        });

        console.log(`📊 Prodotti da ri-arricchire: ${productsToEnrich.length}\n`);

        const baseUrl = 'https://data.icecat.biz/xml_s3/xml_server3.cgi';
        let enriched = 0;
        let failed = 0;

        for (let i = 0; i < productsToEnrich.length; i++) {
            const record = productsToEnrich[i];
            const product = record.masterFile;

            if (!product?.eanGtin) continue;

            process.stdout.write(`\r[${i + 1}/${productsToEnrich.length}] Elaborando: ${product.nomeProdotto?.substring(0, 40) || product.eanGtin}...`);

            try {
                // Prima prova con EAN
                let url = `${baseUrl}?ean_upc=${product.eanGtin}&lang=it&output_product_xml=1`;

                const response = await axios.get(url, {
                    auth: { username, password },
                    timeout: 15000
                });

                const parser = new xml2js.Parser({ explicitArray: false });
                const result = await parser.parseStringPromise(response.data);

                const productData = result['ICECAT-interface']?.Product;

                if (!productData || productData.$?.ErrorMessage) {
                    // Prova con PartNumber + Brand
                    if (product.partNumber && product.marchio?.nome) {
                        url = `${baseUrl}?prod_id=${encodeURIComponent(product.partNumber)}&vendor=${encodeURIComponent(product.marchio.nome)}&lang=it&output_product_xml=1`;
                        const response2 = await axios.get(url, { auth: { username, password }, timeout: 15000 });
                        const result2 = await parser.parseStringPromise(response2.data);
                        const productData2 = result2['ICECAT-interface']?.Product;

                        if (productData2 && !productData2.$?.ErrorMessage) {
                            await updateIcecatRecord(record.id, productData2);
                            enriched++;
                        } else {
                            failed++;
                        }
                    } else {
                        failed++;
                    }
                } else {
                    await updateIcecatRecord(record.id, productData);
                    enriched++;
                }

            } catch (error: any) {
                failed++;
            }

            // Delay per non sovraccaricare l'API
            await new Promise(r => setTimeout(r, 300));
        }

        console.log(`\n\n✅ Arricchimento completato!`);
        console.log(`   ✅ Arricchiti: ${enriched}`);
        console.log(`   ❌ Falliti: ${failed}`);

        // Verifica finale
        const withImages = await prisma.datiIcecat.count({
            where: {
                masterFile: { utenteId },
                urlImmaginiJson: { not: '[]' }
            }
        });

        console.log(`\n📊 Prodotti con immagini ora: ${withImages}`);

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function updateIcecatRecord(recordId: number, productData: any) {
    const attrs = productData.$ || productData || {};

    // Estrai immagini
    const images: string[] = [];
    if (attrs.HighPic) images.push(attrs.HighPic);
    if (productData.ProductGallery?.ProductPicture) {
        const pics = Array.isArray(productData.ProductGallery.ProductPicture)
            ? productData.ProductGallery.ProductPicture
            : [productData.ProductGallery.ProductPicture];
        pics.forEach((p: any) => { if (p.$?.Pic) images.push(p.$.Pic); });
    }

    // Estrai descrizioni
    let shortDesc = '', longDesc = '';
    if (productData.SummaryDescription?.ShortSummaryDescription) {
        const s = productData.SummaryDescription.ShortSummaryDescription;
        shortDesc = typeof s === 'string' ? s : (s._ || s.$?.Value || '');
    }
    if (productData.SummaryDescription?.LongSummaryDescription) {
        const l = productData.SummaryDescription.LongSummaryDescription;
        longDesc = typeof l === 'string' ? l : (l._ || l.$?.Value || '');
    }

    // Estrai specifiche
    const features: any[] = [];
    if (productData.ProductFeature) {
        const feats = Array.isArray(productData.ProductFeature) ? productData.ProductFeature : [productData.ProductFeature];
        feats.forEach((f: any) => {
            const name = f.Feature?.Name?.$?.Value || '';
            const val = f.$?.Presentation_Value || f.$?.Value || '';
            if (name && val) features.push({ name, value: val });
        });
    }

    // Aggiorna record
    await prisma.datiIcecat.update({
        where: { id: recordId },
        data: {
            urlImmaginiJson: JSON.stringify(images),
            descrizioneBrave: shortDesc,
            descrizioneLunga: longDesc,
            specificheTecnicheJson: JSON.stringify(features),
            bulletPointsJson: JSON.stringify(features.slice(0, 5).map(f => `${f.name}: ${f.value}`)),
            updatedAt: new Date()
        }
    });
}

reEnrichIcecatData();
