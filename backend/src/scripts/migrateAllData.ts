
import { PrismaClient } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

const prisma = new PrismaClient();
const DB_PATH = path.join(__dirname, '../../prisma/dev.db');
const db = new sqlite3.Database(DB_PATH);
const dbAll = promisify(db.all).bind(db);

async function main() {
    console.log('🚀 Avvio migrazione completa dati da SQLite a Supabase...');

    // Pulisci tabelle per evitare duplicati se stiamo rieseguendo
    console.log('🧹 Pulizia tabelle regole e mappature...');
    await prisma.productFilterRule.deleteMany();
    await prisma.regolaMarkup.deleteMany();
    // await prisma.mappaturaCampo.deleteMany(); // Non pulire questa per sicurezza

    try {
        // 1. Mappa Fornitori (ID locali -> ID Supabase)
        // Local: Brevi=1, Cometa=2, Runner=3
        // Supabase: Brevi=1, Cometa=2, Runner=5
        const supplierMap: Record<number, number> = { 1: 1, 2: 2, 3: 5 };

        // 2. Mappa Marchi e Categorie per nome (per preservare relazioni)
        const cloudBrands = await prisma.marchio.findMany();
        const cloudCategories = await prisma.categoria.findMany();

        const brandNameToId = new Map(cloudBrands.map(b => [b.nome.toLowerCase(), b.id]));
        const categoryNameToId = new Map(cloudCategories.map(c => [c.nome.toLowerCase(), c.id]));

        // Get local brand/category names
        const localBrands: any[] = await dbAll('SELECT id, nome FROM marchi');
        const localCategories: any[] = await dbAll('SELECT id, nome FROM categorie');

        const localBrandIdToName = new Map(localBrands.map(b => [b.id, b.nome.toLowerCase()]));
        const localCategoryIdToName = new Map(localCategories.map(c => [c.id, c.nome.toLowerCase()]));

        // 3. Aggiorna Fornitori (FTP e Password)
        console.log('\n📝 Aggiornamento impostazioni fornitori...');
        const localFornitori: any[] = await dbAll('SELECT * FROM fornitori');
        for (const f of localFornitori) {
            const cloudId = supplierMap[f.id];
            if (!cloudId) continue;

            await prisma.fornitore.update({
                where: { id: cloudId },
                data: {
                    ftpHost: f.ftpHost,
                    ftpPort: f.ftpPort,
                    ftpDirectory: f.ftpDirectory,
                    username: f.username,
                    passwordEncrypted: f.passwordEncrypted,
                    urlListino: f.urlListino,
                    tipoAccesso: f.tipoAccesso,
                    formatoFile: f.formatoFile,
                    separatoreCSV: f.separatoreCSV,
                    encoding: f.encoding
                }
            });
            console.log(`   ✅ Fornitore "${f.nomeFornitore}" aggiornato.`);
        }

        // 4. Migra Mappature Campi
        console.log('\n🗺️ Migrazione mappature campi...');
        const localMappings: any[] = await dbAll('SELECT * FROM mappatura_campi');
        for (const m of localMappings) {
            const cloudId = supplierMap[m.fornitoreId];
            if (!cloudId) continue;

            await prisma.mappaturaCampo.upsert({
                where: {
                    fornitoreId_campoStandard: {
                        fornitoreId: cloudId,
                        campoStandard: m.campoStandard
                    }
                },
                update: {
                    campoOriginale: m.campoOriginale,
                    tipoDato: m.tipoDato,
                    trasformazioneRichiesta: m.trasformazioneRichiesta
                },
                create: {
                    fornitoreId: cloudId,
                    campoOriginale: m.campoOriginale,
                    campoStandard: m.campoStandard,
                    tipoDato: m.tipoDato,
                    trasformazioneRichiesta: m.trasformazioneRichiesta
                }
            });
        }
        console.log(`   ✅ ${localMappings.length} mappature campi migrate.`);

        // 5. Migra Regole Filtro Prodotti (Inclusioni/Esclusioni)
        console.log('\n🔍 Migrazione regole filtro prodotti...');
        const localFilters: any[] = await dbAll('SELECT * FROM product_filter_rules');
        let filterSuccess = 0;
        for (const f of localFilters) {
            const brandName = f.marchioId ? localBrandIdToName.get(f.marchioId) : null;
            const catName = f.categoriaId ? localCategoryIdToName.get(f.categoriaId) : null;

            const cloudBrandId = brandName ? brandNameToId.get(brandName) : null;
            const cloudCatId = catName ? categoryNameToId.get(catName) : null;

            await prisma.productFilterRule.create({
                data: {
                    nome: f.nome,
                    tipoFiltro: f.tipoFiltro,
                    marchioId: cloudBrandId,
                    categoriaId: cloudCatId,
                    azione: f.azione,
                    attiva: f.attiva === 1,
                    priorita: f.priorita || 1,
                    note: f.note
                }
            });
            filterSuccess++;
        }
        console.log(`   ✅ ${filterSuccess} regole filtro migrate.`);

        // 6. Migra Regole Markup
        console.log('\n💰 Migrazione regole markup...');
        const localMarkup: any[] = await dbAll('SELECT * FROM regole_markup');
        for (const r of localMarkup) {
            const brandName = r.marchioId ? localBrandIdToName.get(r.marchioId) : null;
            const catName = r.categoriaId ? localCategoryIdToName.get(r.categoriaId) : null;
            const cloudBrandId = brandName ? brandNameToId.get(brandName) : null;
            const cloudCatId = catName ? categoryNameToId.get(catName) : null;
            const cloudFornitoreId = r.fornitoreId ? supplierMap[r.fornitoreId] : null;

            await prisma.regolaMarkup.create({
                data: {
                    nome: r.nome,
                    marchioId: cloudBrandId,
                    categoriaId: cloudCatId,
                    fornitoreId: cloudFornitoreId,
                    tipoRegola: r.tipoRegola,
                    riferimento: r.riferimento,
                    markupPercentuale: r.markupPercentuale,
                    markupFisso: r.markupFisso,
                    costoSpedizione: r.costoSpedizione,
                    priorita: r.priorita,
                    attiva: r.attiva === 1
                }
            });
        }
        console.log(`   ✅ ${localMarkup.length} regole markup migrate.`);

        console.log('\n✨ MIGRAZIONE COMPLETA TERMINATA CON SUCCESSO!');

    } catch (error: any) {
        console.error('\n❌ ERRORE CRITICO:', error.message);
    } finally {
        db.close();
        await prisma.$disconnect();
    }
}

main();
