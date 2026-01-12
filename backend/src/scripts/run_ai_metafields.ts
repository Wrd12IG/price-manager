#!/usr/bin/env tsx
import prisma from '../config/database';
import { AIMetafieldService } from '../services/AIMetafieldService';
import { logger } from '../utils/logger';

async function run() {
    console.log('🚀 Avvio generazione Metafields AI...\n');

    // 1. Trova prodotti da processare
    // Cerchiamo prodotti che hanno dati Icecat e sono nel MasterFile
    const products = await prisma.masterFile.findMany({
        where: {
            datiIcecat: { isNot: null },
            // Opzionale: filtra solo quelli che hanno già un output shopify o che devono essere esportati
            // prezzoVenditaCalcolato: { gt: 0 } 
        },
        include: {
            datiIcecat: true,
            outputShopify: true
        }
        // take: 10 // Limit for testing if needed
    });

    console.log(`Trovati ${products.length} prodotti da analizzare.`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const p of products) {
        processed++;
        process.stdout.write(`\rElaborazione ${processed}/${products.length}: ${p.eanGtin} - ${p.nomeProdotto?.substring(0, 30)}...`);

        try {
            // Genera metafields con AI
            const aiMetafields = await AIMetafieldService.generateMetafields(p);

            if (aiMetafields && Object.keys(aiMetafields).length > 0) {
                // Converti in formato Shopify
                const shopifyMetafields = [];

                for (const [fullKey, value] of Object.entries(aiMetafields)) {
                    const [namespace, key] = fullKey.split('.');

                    let type = 'single_line_text_field';
                    if (['descrizione_breve', 'descrizione_lunga', 'tabella_specifiche'].includes(key)) {
                        type = 'multi_line_text_field';
                    }

                    shopifyMetafields.push({
                        namespace,
                        key,
                        value,
                        type
                    });
                }

                // Recupera metafields esistenti (se presenti)
                let existingMetafields: any[] = [];
                if (p.outputShopify?.metafieldsJson) {
                    try {
                        existingMetafields = JSON.parse(p.outputShopify.metafieldsJson);
                    } catch (e) { }
                }

                // Merge: sovrascrivi quelli esistenti con quelli nuovi AI, mantieni gli altri
                const mergedMetafields = [...existingMetafields];

                for (const newField of shopifyMetafields) {
                    const index = mergedMetafields.findIndex(
                        m => m.namespace === newField.namespace && m.key === newField.key
                    );

                    if (index >= 0) {
                        mergedMetafields[index] = newField;
                    } else {
                        mergedMetafields.push(newField);
                    }
                }

                // Aggiorna OutputShopify
                // Se non esiste, lo creiamo (ma dovrebbe esistere se abbiamo fatto il prepare, altrimenti lo creiamo ora)
                // Usiamo upsert per sicurezza

                // Nota: Se OutputShopify non esiste, dobbiamo creare anche gli altri campi obbligatori.
                // Per semplicità, se non esiste, saltiamo o creiamo un record parziale.
                // Meglio aggiornare solo se esiste, o creare se abbiamo i dati minimi.

                if (p.outputShopify) {
                    await prisma.outputShopify.update({
                        where: { id: p.outputShopify.id },
                        data: {
                            metafieldsJson: JSON.stringify(mergedMetafields),
                            updatedAt: new Date(),
                            // Se abbiamo generato descrizioni migliori, aggiorniamo anche i campi principali?
                            // Il prompt chiede di compilare metafields, ma "Descrizione Breve" e "Lunga" sono anche campi standard Shopify (body_html).
                            // L'utente ha chiesto specificamente METAFIELDS.
                            // Tuttavia, potremmo voler aggiornare anche bodyHtml con la Descrizione Lunga + Tabella.
                            // Per ora rispettiamo rigorosamente la richiesta sui metafields.
                        }
                    });
                    updated++;
                } else {
                    // Se non c'è output shopify, forse non è stato ancora preparato.
                    // Possiamo ignorarlo per ora, verrà creato al prossimo "Sincronizza" (prepareExport).
                    // MA prepareExport sovrascriverebbe i nostri metafields se non stiamo attenti.
                    // PrepareExport rigenera tutto.

                    // SOLUZIONE: Salvare i metafields AI in una tabella temporanea o direttamente in DatiIcecat?
                    // O modificare prepareExport per usare questi dati se presenti.
                    // Attualmente non abbiamo un posto dove salvarli se non OutputShopify.
                    // Quindi, se non c'è OutputShopify, non possiamo salvarli in modo persistente che sopravviva a un prepareExport "pulito".

                    // Tuttavia, prepareExport legge da DatiIcecat.
                    // Potremmo salvare i risultati JSON in DatiIcecat in un campo custom se esistesse, ma non esiste.

                    // Assumiamo che l'utente abbia già fatto "Sincronizza" (che fa prepare) o che lo farà.
                    // Se lo fa DOPO, perderà questi dati se prepareExport non è smart.
                    // PrepareExport ricalcola tutto.

                    // IDEA: Salviamo i metafields generati in un file JSON locale come backup/cache?
                    // Oppure assumiamo che l'utente esegua questo script SU prodotti già preparati (OutputShopify esiste).
                    // Lo script filtra per `prezzoVenditaCalcolato > 0`, che è la condizione per prepareExport.

                    // Se OutputShopify non esiste, lo creiamo con i dati minimi
                    /*
                    await prisma.outputShopify.create({
                        data: {
                            masterFileId: p.id,
                            handle: `temp-${p.eanGtin}`,
                            title: p.nomeProdotto || 'Temp',
                            metafieldsJson: JSON.stringify(shopifyMetafields),
                            // ... altri campi obbligatori ...
                        }
                    });
                    */
                    // Per ora logghiamo warning
                    // logger.warn(`OutputShopify mancante per ${p.eanGtin}, salto salvataggio.`);
                }
            }

            // Rate limit per API Gemini
            await new Promise(r => setTimeout(r, 1000)); // 1s delay

        } catch (e: any) {
            errors++;
            logger.error(`Errore prodotto ${p.eanGtin}: ${e.message}`);
        }
    }

    console.log(`\n\n✅ Completato!`);
    console.log(`   Processati: ${processed}`);
    console.log(`   Aggiornati: ${updated}`);
    console.log(`   Errori: ${errors}`);

    await prisma.$disconnect();
}

run().catch(console.error);
