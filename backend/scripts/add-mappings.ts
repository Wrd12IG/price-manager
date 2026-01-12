import prisma from '../src/config/database';

async function addMissingMappings() {
    console.log('Aggiunta mappature mancanti per marca e categoria...');

    // Mappature per Brevi (fornitore 1)
    await prisma.mappaturaCampo.upsert({
        where: {
            fornitoreId_campoOriginale: {
                fornitoreId: 1,
                campoOriginale: 'Produttore'
            }
        },
        update: {},
        create: {
            fornitoreId: 1,
            campoOriginale: 'Produttore',
            campoStandard: 'marca',
            tipoDato: 'string'
        }
    });

    await prisma.mappaturaCampo.upsert({
        where: {
            fornitoreId_campoOriginale: {
                fornitoreId: 1,
                campoOriginale: 'Categoria'
            }
        },
        update: {},
        create: {
            fornitoreId: 1,
            campoOriginale: 'Categoria',
            campoStandard: 'categoria',
            tipoDato: 'string'
        }
    });

    await prisma.mappaturaCampo.upsert({
        where: {
            fornitoreId_campoOriginale: {
                fornitoreId: 1,
                campoOriginale: 'Descri'
            }
        },
        update: {},
        create: {
            fornitoreId: 1,
            campoOriginale: 'Descri',
            campoStandard: 'nome',
            tipoDato: 'string'
        }
    });

    console.log('✅ Mappature aggiunte per Brevi');

    // TODO: Aggiungi mappature per Cometa e Runner quando conosci i nomi dei campi

    await prisma.$disconnect();
}

addMissingMappings().catch(console.error);
