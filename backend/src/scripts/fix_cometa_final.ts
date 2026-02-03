import prisma from '../src/config/database';

async function fixCometa() {
    console.log('🔧 Fixing Cometa configuration and mappings...');

    const fornitore = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Cometa' } }
    });

    if (!fornitore) {
        console.error('❌ Cometa fornitore not found');
        return;
    }

    console.log(`Found Fornitore ID: ${fornitore.id}`);

    // 1. Update Fornitore general settings
    await prisma.fornitore.update({
        where: { id: fornitore.id },
        data: {
            separatoreCSV: ';',
            encoding: 'ISO-8859-1', // Molto probabile per server italiani
            formatoFile: 'CSV'
        }
    });

    // 2. Clear existing mappings to avoid conflicts
    await prisma.mappaturaCampo.deleteMany({
        where: { fornitoreId: fornitore.id }
    });

    // 3. Create correct mappings based on analyze_cometa_file.ts
    const correctMappings = [
        { campoOriginale: 'Articolo', campoStandard: 'sku' },
        { campoOriginale: 'CodiceEAN', campoStandard: 'ean' },
        { campoOriginale: 'CodiceArticoloProduttore', campoStandard: 'part_number' },
        { campoOriginale: 'Descrizione', campoStandard: 'nome' },
        { campoOriginale: 'Produttore', campoStandard: 'marca' },
        { campoOriginale: 'DescriCatOmo', campoStandard: 'categoria' },
        { campoOriginale: 'Prezzo', campoStandard: 'prezzo' },
        { campoOriginale: 'DisponibilitaDeposito', campoStandard: 'quantita' }
    ];

    for (const m of correctMappings) {
        await prisma.mappaturaCampo.create({
            data: {
                fornitoreId: fornitore.id,
                campoOriginale: m.campoOriginale,
                campoStandard: m.campoStandard
            }
        });
        console.log(`✅ Mapped ${m.campoOriginale} -> ${m.campoStandard}`);
    }

    console.log('🚀 Cometa fix completed!');
}

fixCometa()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
