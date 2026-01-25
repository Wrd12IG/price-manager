
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mappings = [
    // BREVI (ID: 1)
    { fornitoreId: 1, campoOriginale: 'Categoria', campoStandard: 'categoria', tipoDato: 'string' },
    { fornitoreId: 1, campoOriginale: 'Descri', campoStandard: 'descrizione', tipoDato: 'string' },
    { fornitoreId: 1, campoOriginale: 'EAN', campoStandard: 'ean', tipoDato: 'string' },
    { fornitoreId: 1, campoOriginale: 'Produttore', campoStandard: 'marca', tipoDato: 'string' },
    { fornitoreId: 1, campoOriginale: 'Articolo', campoStandard: 'nome', tipoDato: 'string' },
    { fornitoreId: 1, campoOriginale: 'PrezzoNetto', campoStandard: 'prezzo', tipoDato: 'number' },
    { fornitoreId: 1, campoOriginale: 'Articolo', campoStandard: 'product_code', tipoDato: 'string' },
    { fornitoreId: 1, campoOriginale: 'Disp_SEDE', campoStandard: 'quantita', tipoDato: 'number' },
    { fornitoreId: 1, campoOriginale: 'CodArtFor', campoStandard: 'sku', tipoDato: 'string' },

    // COMETA (ID: 2)
    { fornitoreId: 2, campoOriginale: 'DescriCatOmo', campoStandard: 'categoria', tipoDato: 'string' },
    { fornitoreId: 2, campoOriginale: 'Descrizione', campoStandard: 'descrizione', tipoDato: 'string' },
    { fornitoreId: 2, campoOriginale: 'CodiceEAN', campoStandard: 'ean', tipoDato: 'string' },
    { fornitoreId: 2, campoOriginale: 'Produttore', campoStandard: 'marca', tipoDato: 'string' },
    { fornitoreId: 2, campoOriginale: 'Descrizione', campoStandard: 'nome', tipoDato: 'string' },
    { fornitoreId: 2, campoOriginale: 'Prezzo', campoStandard: 'prezzo', tipoDato: 'number' },
    { fornitoreId: 2, campoOriginale: 'CodiceArticoloProduttore', campoStandard: 'product_code', tipoDato: 'string' },
    { fornitoreId: 2, campoOriginale: 'DisponibilitaDeposito', campoStandard: 'quantita', tipoDato: 'number' },
    { fornitoreId: 2, campoOriginale: 'CodiceArticoloProduttore', campoStandard: 'sku', tipoDato: 'string' },

    // RUNNER (ID: 5)
    { fornitoreId: 5, campoOriginale: 'DescCatMerc', campoStandard: 'categoria', tipoDato: 'string' },
    { fornitoreId: 5, campoOriginale: 'DescrizioneEstesa', campoStandard: 'descrizione', tipoDato: 'string' },
    { fornitoreId: 5, campoOriginale: 'CodiceEAN', campoStandard: 'ean', tipoDato: 'string' },
    { fornitoreId: 5, campoOriginale: 'Produttore', campoStandard: 'marca', tipoDato: 'string' },
    { fornitoreId: 5, campoOriginale: 'Descrizione', campoStandard: 'nome', tipoDato: 'string' },
    { fornitoreId: 5, campoOriginale: 'PrezzoPers', campoStandard: 'prezzo', tipoDato: 'number' },
    { fornitoreId: 5, campoOriginale: 'CodiceProduttore', campoStandard: 'product_code', tipoDato: 'string' },
    { fornitoreId: 5, campoOriginale: 'Quantita', campoStandard: 'quantita', tipoDato: 'number' },
    { fornitoreId: 5, campoOriginale: 'CodiceProduttore', campoStandard: 'sku', tipoDato: 'string' }
];

async function main() {
    console.log('🔄 Sincronizzazione mappature campi...');

    for (const mapping of mappings) {
        try {
            await prisma.mappaturaCampo.upsert({
                where: {
                    fornitoreId_campoStandard: {
                        fornitoreId: mapping.fornitoreId,
                        campoStandard: mapping.campoStandard
                    }
                },
                update: {
                    campoOriginale: mapping.campoOriginale,
                    tipoDato: mapping.tipoDato
                },
                create: mapping
            });
            console.log(`✅ Mappatura [${mapping.campoStandard}] per fornitore ${mapping.fornitoreId} salvata.`);
        } catch (error: any) {
            console.error(`❌ Errore mappatura [${mapping.campoStandard}] fornitore ${mapping.fornitoreId}:`, error.message);
        }
    }

    console.log('\n✨ Sincronizzazione completata!');
    await prisma.$disconnect();
}

main();
