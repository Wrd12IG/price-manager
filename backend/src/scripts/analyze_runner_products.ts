import prisma from '../config/database';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

async function checkRunnerProducts() {
    console.log('🔍 Analisi Listino Runner...\n');

    try {
        // 1. Trova ID fornitore Runner
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: { contains: 'Runner' } }
        });

        if (!runner) {
            console.error('❌ Fornitore "Runner" non trovato nel database!');
            return;
        }

        console.log(`✅ Fornitore trovato: ${runner.nomeFornitore} (ID: ${runner.id})`);

        // 2. Conta prodotti nel ListinoRaw (prodotti grezzi importati)
        const rawCount = await prisma.listinoRaw.count({
            where: { fornitoreId: runner.id }
        });

        console.log(`📊 Prodotti in ListinoRaw (importati nel DB): ${rawCount}`);

        // 3. Conta prodotti nel MasterFile (prodotti consolidati e validi)
        const masterCount = await prisma.masterFile.count({
            where: { fornitoreSelezionatoId: runner.id }
        });

        console.log(`📊 Prodotti in MasterFile (consolidati): ${masterCount}`);

        // 4. Cerca file sorgente locale per confronto
        const importDir = path.join(__dirname, '../../import');
        if (fs.existsSync(importDir)) {
            const files = fs.readdirSync(importDir);
            const runnerFiles = files.filter(f => f.toLowerCase().includes('runner') && f.endsWith('.csv'));

            if (runnerFiles.length > 0) {
                console.log('\n📂 File Runner trovati nella cartella import:');
                for (const file of runnerFiles) {
                    const filePath = path.join(importDir, file);
                    const stats = fs.statSync(filePath);
                    console.log(`   - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

                    // Conta righe CSV (approssimativo)
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const lines = content.split('\n').length;
                    console.log(`     📝 Righe stimate nel file: ${lines}`);
                }
            } else {
                console.log('\n⚠️ Nessun file CSV Runner trovato nella cartella import locale.');
            }
        }

        // 5. Analisi categorie (per capire se manca qualche settore)
        console.log('\n📋 Top 10 Categorie importate:');
        const categories = await prisma.listinoRaw.groupBy({
            by: ['categoriaFornitore'],
            where: { fornitoreId: runner.id },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10
        });

        categories.forEach(c => {
            console.log(`   - ${c.categoriaFornitore || 'SENZA CATEGORIA'}: ${c._count.id}`);
        });

    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkRunnerProducts();
