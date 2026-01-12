
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSaveMappatura() {
    const fornitoreId = 3;
    console.log('--- Debug Save Mappatura Fornitore 3 ---');

    try {
        // Simula un payload che potrebbe causare errore (duplicati)
        // Supponiamo che l'utente stia mappando due campi alla stessa colonna "Codice"
        const payload = {
            sku: "Codice",
            ean: "Codice" // DUPLICATO!
        };

        console.log('Tentativo salvataggio con duplicati:', payload);

        await prisma.$transaction(async (tx) => {
            // 1. Elimina mappature esistenti
            await tx.mappaturaCampo.deleteMany({
                where: { fornitoreId: fornitoreId }
            });

            // 2. Prepara i nuovi record
            const nuoviRecord = Object.entries(payload)
                .map(([campoStandard, colonnaFile]) => ({
                    fornitoreId: fornitoreId,
                    campoStandard: campoStandard,
                    campoOriginale: colonnaFile,
                    tipoDato: 'string'
                }));

            console.log('Inserimento record:', nuoviRecord);

            await tx.mappaturaCampo.createMany({
                data: nuoviRecord
            });
        });

        console.log('Salvataggio riuscito (inaspettato se c\'è vincolo unique)');

    } catch (error: any) {
        console.error('Errore catturato:', error.message);
        if (error.code === 'P2002') {
            console.log('✅ CONFERMATO: Violazione vincolo di unicità!');
            console.log('Il DB impedisce di mappare più campi standard sulla stessa colonna originale.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

debugSaveMappatura();
