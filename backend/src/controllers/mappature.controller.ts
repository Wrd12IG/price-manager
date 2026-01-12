import { Request, Response } from 'express';
import prisma from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';

// Campi standard del sistema a cui mappare i dati del fornitore
export const CAMPI_STANDARD = [
    { key: 'sku', label: 'SKU / Codice Articolo', required: false },
    { key: 'ean', label: 'EAN / GTIN', required: true },
    { key: 'nome', label: 'Nome Prodotto', required: false },
    { key: 'descrizione', label: 'Descrizione', required: false },
    { key: 'prezzo', label: 'Prezzo Acquisto', required: false },
    { key: 'quantita', label: 'Quantità / Disponibilità', required: false },
    { key: 'marca', label: 'Marca / Produttore', required: false },
    { key: 'categoria', label: 'Categoria', required: false },
    { key: 'immagini', label: 'URL Immagine', required: false },
    { key: 'product_code', label: 'Product Code (Codice Prodotto)', required: false },
];

/**
 * GET /api/mappature/campi/standard
 * Restituisce la lista dei campi standard del sistema
 */
export const getCampiStandard = asyncHandler(async (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: CAMPI_STANDARD
    });
});

/**
 * GET /api/mappature/campi/:fornitoreId
 * Ottiene la configurazione di mappatura salvata per un fornitore
 */
export const getMappaturaFornitore = asyncHandler(async (req: Request, res: Response) => {
    const { fornitoreId } = req.params;

    const mappature = await prisma.mappaturaCampo.findMany({
        where: { fornitoreId: parseInt(fornitoreId) }
    });

    // Trasforma in un oggetto chiave-valore per facile consumo frontend
    const mappaturaObj: Record<string, string> = {};
    mappature.forEach((m: any) => {
        mappaturaObj[m.campoStandard] = m.campoOriginale;
    });

    res.json({
        success: true,
        data: mappaturaObj
    });
});

/**
 * POST /api/mappature/campi/:fornitoreId
 * Salva o aggiorna la mappatura campi per un fornitore
 */
export const saveMappaturaFornitore = asyncHandler(async (req: Request, res: Response) => {
    const { fornitoreId } = req.params;
    const mappature: Record<string, string> = req.body; // { sku: "Codice_Art", prezzo: "Price", ... }

    const id = parseInt(fornitoreId);

    // Verifica esistenza fornitore
    const fornitore = await prisma.fornitore.findUnique({ where: { id } });
    if (!fornitore) {
        throw new AppError('Fornitore non trovato', 404);
    }

    // Usa una transazione per cancellare le vecchie mappature e inserire le nuove
    // (O fare upsert, ma delete+create è più pulito per gestire rimozioni)
    await prisma.$transaction(async (tx: any) => {
        // 1. Elimina mappature esistenti per questo fornitore
        await tx.mappaturaCampo.deleteMany({
            where: { fornitoreId: id }
        });

        // 2. Prepara i nuovi record
        const nuoviRecord = Object.entries(mappature)
            .filter(([_, colonnaFile]) => colonnaFile) // Ignora mappature vuote
            .map(([campoStandard, colonnaFile]) => ({
                fornitoreId: id,
                campoStandard: campoStandard,
                campoOriginale: colonnaFile,
                tipoDato: 'string',
                trasformazioneRichiesta: null
            }));

        if (nuoviRecord.length > 0) {
            await tx.mappaturaCampo.createMany({
                data: nuoviRecord
            });
        }
    });

    res.json({
        success: true,
        message: 'Mappatura salvata con successo'
    });
});
