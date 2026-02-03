// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

// Campi standard del sistema
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
    { key: 'part_number', label: 'Part Number / Codice Produttore', required: false },
];

export const getCampiStandard = asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: CAMPI_STANDARD });
});

export const getMappaturaFornitore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fornitoreId } = req.params;
    const utenteId = req.utenteId;

    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Verifica che il fornitore appartenga all'utente
    const fornitore = await prisma.fornitore.findFirst({
        where: { id: parseInt(fornitoreId), utenteId }
    });

    // Se il fornitore non viene trovato (es. cancellato o ID errato),
    // invece di 404 restituiamo oggetto vuoto per evitare errori in console sul frontend.
    // Questo permette all'utente di vedere la UI "pulita" invece di un errore.
    if (!fornitore) {
        console.warn(`Fornitore ${fornitoreId} non trovato per utente ${utenteId} in getMappatura - Ritorno empty`);
        return res.json({ success: true, data: {} });
    }

    const mappature = await prisma.mappaturaCampo.findMany({
        where: { fornitoreId: parseInt(fornitoreId) }
    });

    const mappaturaObj: Record<string, string> = {};
    mappature.forEach((m: any) => {
        mappaturaObj[m.campoStandard] = m.campoOriginale;
    });

    res.json({ success: true, data: mappaturaObj });
});

export const saveMappaturaFornitore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { fornitoreId } = req.params;
    const utenteId = req.utenteId;
    const mappature: Record<string, string> = req.body;

    if (!utenteId) throw new AppError('Non autorizzato', 401);
    const id = parseInt(fornitoreId);

    // Verifica esistenza generica e proprietà
    const fornitoreEsistente = await prisma.fornitore.findUnique({ where: { id } });
    
    if (!fornitoreEsistente) {
        throw new AppError('Fornitore non trovato', 404);
    }

    if (fornitoreEsistente.utenteId !== utenteId) {
        // Log per debug
        console.warn(`[SAVE_MAPPATURA] Tentativo di modifica fornitore ${id} (utente ${fornitoreEsistente.utenteId}) da parte di utente ${utenteId}`);
        throw new AppError('Questo fornitore appartiene a un altro utente. Crea un NUOVO fornitore per gestire il tuo listino e la tua mappatura.', 403);
    }

    await prisma.$transaction(async (tx: any) => {
        await tx.mappaturaCampo.deleteMany({ where: { fornitoreId: id } });

        const nuoviRecord = Object.entries(mappature)
            .filter(([_, colonnaFile]) => colonnaFile)
            .map(([campoStandard, colonnaFile]) => ({
                fornitoreId: id,
                campoStandard: campoStandard,
                campoOriginale: colonnaFile,
                tipoDato: 'string'
            }));

        if (nuoviRecord.length > 0) {
            await tx.mappaturaCampo.createMany({ data: nuoviRecord });
        }
    });

    res.json({ success: true, message: 'Mappatura salvata con successo' });
});
