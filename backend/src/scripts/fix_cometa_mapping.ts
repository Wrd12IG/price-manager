import prisma from '../config/database';

async function fixCometaMapping() {
    console.log('🔧 Correzione Mappatura Cometa...');

    const cometa = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!cometa) {
        console.error('❌ Cometa non trovato');
        return;
    }

    // 1. Correggi Articolo -> sku
    const mapArticolo = await prisma.mappaturaCampo.findFirst({
        where: { fornitoreId: cometa.id, campoOriginale: 'Articolo' }
    });

    if (mapArticolo) {
        console.log('Aggiorno mappatura Articolo -> sku');
        await prisma.mappaturaCampo.update({
            where: { id: mapArticolo.id },
            data: { campoStandard: 'sku' }
        });
    } else {
        console.log('Creo mappatura Articolo -> sku');
        await prisma.mappaturaCampo.create({
            data: {
                fornitoreId: cometa.id,
                campoOriginale: 'Articolo',
                campoStandard: 'sku'
            }
        });
    }

    // 2. Aggiungi Descrizione -> nome (se non esiste)
    const mapNome = await prisma.mappaturaCampo.findFirst({
        where: { fornitoreId: cometa.id, campoStandard: 'nome' }
    });

    if (mapNome && mapNome.campoOriginale === 'Articolo') {
        // Se Articolo era mappato a nome, ora lo abbiamo cambiato sopra (se era lo stesso record)
        // Ma se abbiamo creato un nuovo record o aggiornato, dobbiamo assicurarci che 'nome' sia mappato a 'Descrizione'
    }

    // Verifica se esiste già una mappatura per 'nome'
    const existingNome = await prisma.mappaturaCampo.findFirst({
        where: { fornitoreId: cometa.id, campoStandard: 'nome' }
    });

    if (!existingNome) {
        console.log('Creo mappatura Descrizione -> nome');
        await prisma.mappaturaCampo.create({
            data: {
                fornitoreId: cometa.id,
                campoOriginale: 'Descrizione',
                campoStandard: 'nome'
            }
        });
    }

    console.log('✅ Mappatura corretta.');
}

fixCometaMapping()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
