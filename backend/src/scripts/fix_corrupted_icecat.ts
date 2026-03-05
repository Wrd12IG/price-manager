// @ts-nocheck
/**
 * 🔍 SCRIPT DI DIAGNOSI: Trova descrizioni errate nel db
 * 
 * Cerca prodotti che hanno dati ICECAT con descrizioni inconsistenti
 * rispetto al marchio/categoria attesi (es. "acqua Panna" su prodotti ASUS)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Keyword che NON dovrebbero mai apparire nelle descrizioni di prodotti tech
const NON_TECH_KEYWORDS = [
    'acqua', 'panna', 'bevanda', 'alimento', 'alimentare', 'bottigli',
    'succo', 'birra', 'vino', 'latte', 'ml', 'cl', 'litri',
    'cibo', 'food', 'drink', 'abbigliamento', 'scarpe', 'tessile'
];

// Marchi tech attesi (non esaustivo - usato per cross-check)
const TECH_BRANDS = [
    'asus', 'acer', 'hp', 'dell', 'lenovo', 'msi', 'samsung', 'lg',
    'logitech', 'microsoft', 'apple', 'intel', 'amd', 'nvidia', 'corsair',
    'kingston', 'western digital', 'seagate', 'epson', 'canon', 'brother'
];

async function findCorruptedDescriptions() {
    try {
        console.log('\n🔍 ===== DIAGNOSI DESCRIZIONI ERRATE =====\n');

        // Trova tutti i prodotti con dati Icecat
        const products = await prisma.masterFile.findMany({
            where: {
                datiIcecat: { isNot: null }
            },
            include: {
                marchio: { select: { nome: true } },
                categoria: { select: { nome: true } },
                datiIcecat: {
                    select: {
                        id: true,
                        eanGtin: true,
                        descrizioneBrave: true,
                        descrizioneLunga: true,
                        masterFileId: true
                    }
                }
            },
            take: 5000
        });

        console.log(`📊 Analisi di ${products.length} prodotti con dati Icecat...\n`);

        const corrupted: any[] = [];
        const mismatchedBrand: any[] = [];

        for (const p of products) {
            const icecat = p.datiIcecat;
            if (!icecat) continue;

            const descBrave = (icecat.descrizioneBrave || '').toLowerCase();
            const descLunga = (icecat.descrizioneLunga || '').toLowerCase();
            const fullDesc = `${descBrave} ${descLunga}`;

            // Check 1: keyword non-tech nelle descrizioni
            const badKeyword = NON_TECH_KEYWORDS.find(kw => fullDesc.includes(kw));
            if (badKeyword) {
                corrupted.push({
                    masterFileId: p.id,
                    ean: p.eanGtin,
                    marchio: p.marchio?.nome,
                    categoria: p.categoria?.nome,
                    descBreve: icecat.descrizioneBrave?.substring(0, 100),
                    badKeyword,
                    icecatId: icecat.id
                });
            }

            // Check 2: marchio del prodotto non menzionato nelle descrizioni
            if (p.marchio?.nome) {
                const brandLower = p.marchio.nome.toLowerCase();
                const isTechBrand = TECH_BRANDS.some(tb => brandLower.includes(tb) || tb.includes(brandLower));

                if (isTechBrand && fullDesc.length > 50) {
                    // Per marchi tech noti, verifica che il nome del marchio sia nella descrizione
                    if (!fullDesc.includes(brandLower)) {
                        mismatchedBrand.push({
                            masterFileId: p.id,
                            ean: p.eanGtin,
                            marchio: p.marchio.nome,
                            descBreve: icecat.descrizioneBrave?.substring(0, 100),
                            icecatId: icecat.id
                        });
                    }
                }
            }
        }

        // Risultati
        console.log(`🚨 DESCRIZIONI CON KEYWORD NON-TECH (probabilmente errate): ${corrupted.length}`);
        if (corrupted.length > 0) {
            corrupted.forEach(p => {
                console.log(`\n   ❌ MasterFile ID: ${p.masterFileId}`);
                console.log(`      EAN: ${p.ean}`);
                console.log(`      Marchio atteso: ${p.marchio} | Categoria: ${p.categoria}`);
                console.log(`      Descrizione: "${p.descBreve}"`);
                console.log(`      Keyword sospetta: "${p.badKeyword}"`);
            });
        }

        console.log(`\n⚠️  DESCRIZIONI CON MARCHIO NON CORRISPONDENTE: ${mismatchedBrand.length}`);
        if (mismatchedBrand.length > 0 && mismatchedBrand.length <= 20) {
            mismatchedBrand.forEach(p => {
                console.log(`\n   ⚠️  MasterFile ID: ${p.masterFileId}`);
                console.log(`      EAN: ${p.ean}`);
                console.log(`      Marchio: ${p.marchio}`);
                console.log(`      Descrizione: "${p.descBreve}"`);
            });
        } else if (mismatchedBrand.length > 20) {
            console.log(`   (troppi da mostrare, usa --fix per rimuoverli tutti)`);
        }

        // Azione di pulizia
        const args = process.argv.slice(2);
        if (args.includes('--fix')) {
            console.log('\n\n🔧 MODALITÀ FIX: Eliminazione datiIcecat errati...\n');

            // Rimuovi solo quelli con keyword non-tech (sicuro al 100%)
            const idsToDelete = corrupted.map(p => p.icecatId);

            if (idsToDelete.length > 0) {
                const deleted = await prisma.datiIcecat.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
                console.log(`✅ Eliminati ${deleted.count} record datiIcecat con descrizioni non-tech`);
                console.log(`   Questi prodotti verranno re-arricchiti al prossimo ciclo Icecat`);
                console.log(`   con la nuova validazione del marchio attiva`);
            } else {
                console.log('   Nessun record da eliminare - database pulito!');
            }
        } else {
            if (corrupted.length > 0 || mismatchedBrand.length > 0) {
                console.log('\n💡 Per eliminare i record errati e forzare la re-arricchimento, esegui:');
                console.log('   npx ts-node src/scripts/fix_corrupted_icecat.ts --fix');
            } else {
                console.log('\n✅ Nessuna descrizione errata trovata - database OK!');
            }
        }

        console.log('\n✅ Analisi completata!\n');

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findCorruptedDescriptions();
