
import { PrismaClient } from '@prisma/client';
import { ImportService } from './src/services/ImportService';

const prisma = new PrismaClient();

async function runImportBrevi() {
    console.log('🔍 Cerco il fornitore Brevi...');

    // Cerca Brevi (case insensitive)
    const fornitore = await prisma.fornitore.findFirst({
        where: {
            nomeFornitore: {
                contains: 'Brevi',
                // mode: 'insensitive' // Non supportato in sqlite, ma 'contains' di solito basta
            }
        }
    });

    if (!fornitore) {
        console.error('❌ Fornitore Brevi non trovato nel database!');
        const allFornitori = await prisma.fornitore.findMany();
        console.log('Fornitori disponibili:', allFornitori.map(f => `${f.id}: ${f.nomeFornitore}`).join(', '));
        process.exit(1);
    }

    console.log(`✅ Trovato Brevi (ID: ${fornitore.id}). Avvio importazione...`);

    try {
        const result = await ImportService.importaListino(fornitore.id);
        console.log('🎉 Importazione completata con successo!');
        console.log(`📦 Prodotti inseriti/aggiornati: ${result.prodottiProcessati}`);
        console.log(`⏱️ Tempo impiegato: ${result.tempoEsecuzioneMs}ms`);
    } catch (error) {
        console.error('❌ Errore durante l\'importazione:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runImportBrevi();
