
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Ripristino configurazione Fornitori e Filtri...');

    // 1. Ripristina Fornitore Runner
    const runner = await prisma.fornitore.upsert({
        where: { nomeFornitore: 'Runner' },
        update: {
            attivo: true,
            tipoAccesso: 'http_auth',
            formatoFile: 'CSV',
            separatoreCSV: ';'
        },
        create: {
            nomeFornitore: 'Runner',
            urlListino: 'https://www.runner.it/listino.csv', // Placeholder URL
            formatoFile: 'CSV',
            tipoAccesso: 'http_auth',
            attivo: true,
            separatoreCSV: ';',
            encoding: 'UTF-8',
            frequenzaAggiornamento: 'daily'
        }
    });
    console.log(`✅ Fornitore ripristinato: ${runner.nomeFornitore}`);

    // 2. Ripristina Regole Filtro (Asus + Notebook)

    // Regola Brand: Asus
    const asusRule = await prisma.productFilterRule.upsert({
        where: { id: 1 }, // Assumiamo ID 1 per semplicità, o cerchiamo di creare se non esiste
        update: {
            nome: 'Solo Asus',
            tipoFiltro: 'brand',
            brand: 'Asus',
            azione: 'include',
            attiva: true
        },
        create: {
            nome: 'Solo Asus',
            tipoFiltro: 'brand',
            brand: 'Asus',
            azione: 'include',
            priorita: 1,
            attiva: true
        }
    });
    console.log(`✅ Regola Filtro ripristinata: ${asusRule.nome}`);

    // Regola Categoria: Notebook
    // Nota: Se vogliamo AND (Asus AND Notebook), dobbiamo avere entrambe le regole attive
    // Se vogliamo OR, la logica attuale le gestisce come OR tra gruppi diversi? No, AND tra gruppi diversi.
    // Quindi Brand=Asus AND Category=Notebook

    // Cerchiamo se esiste già una regola per Notebook, altrimenti creiamo
    const notebookRule = await prisma.productFilterRule.findFirst({
        where: { tipoFiltro: 'category', categoria: 'Notebook' }
    });

    if (notebookRule) {
        await prisma.productFilterRule.update({
            where: { id: notebookRule.id },
            data: { attiva: true }
        });
        console.log(`✅ Regola Filtro ripristinata: Notebook (aggiornata)`);
    } else {
        await prisma.productFilterRule.create({
            data: {
                nome: 'Solo Notebook',
                tipoFiltro: 'category',
                categoria: 'Notebook',
                azione: 'include',
                priorita: 1,
                attiva: true
            }
        });
        console.log(`✅ Regola Filtro creata: Solo Notebook`);
    }

    console.log('🎉 Ripristino completato!');
}

main()
    .catch(e => {
        console.error('❌ Errore durante il ripristino:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
