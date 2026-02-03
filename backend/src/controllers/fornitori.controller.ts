// @ts-nocheck
import { Response } from 'express';
import prisma from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import axios from 'axios';
import { ImportService } from '../services/ImportService';
import { FileParserService } from '../services/FileParserService';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/fornitori
 * Ottieni tutti i fornitori dell'utente loggato
 */
export const getAllFornitori = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    logger.info(`[GET_ALL_FORNITORI] Richiesta da utenteId: ${utenteId}`);
    const fornitori = await prisma.fornitore.findMany({
        where: { utenteId },
        include: {
            _count: {
                select: {
                    mappatureCampi: true,
                    mappatureCategorie: true,
                    listiniRaw: true
                }
            }
        },
        orderBy: { nomeFornitore: 'asc' }
    });

    // Rimuovi password criptate dalla risposta
    const fornitoriSafe = fornitori.map((f: any) => ({
        ...f,
        passwordEncrypted: f.passwordEncrypted ? '***' : null
    }));

    res.json({
        success: true,
        data: fornitoriSafe
    });
});

/**
 * GET /api/fornitori/:id
 */
export const getFornitoreById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    const fornitore = await prisma.fornitore.findFirst({
        where: { id: parseInt(id), utenteId },
        include: {
            mappatureCampi: true,
            mappatureCategorie: true,
            _count: {
                select: { listiniRaw: true }
            }
        }
    });

    if (!fornitore) {
        throw new AppError('Fornitore non trovato o accesso negato', 404);
    }

    const fornitoreSafe = {
        ...fornitore,
        passwordEncrypted: fornitore.passwordEncrypted ? '***' : null
    };

    res.json({
        success: true,
        data: fornitoreSafe
    });
});

/**
 * POST /api/fornitori
 */
export const createFornitore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    const {
        nomeFornitore,
        urlListino,
        formatoFile,
        tipoAccesso,
        username,
        password,
        frequenzaAggiornamento,
        cronExpression,
        encoding,
        separatoreCSV,
        ftpHost,
        ftpPort,
        ftpDirectory
    } = req.body;

    if (!nomeFornitore || !formatoFile || !tipoAccesso) {
        throw new AppError('Campi obbligatori mancanti', 400);
    }

    const passwordEncrypted = password ? encrypt(password) : null;

    const fornitore = await prisma.fornitore.create({
        data: {
            utenteId,
            nomeFornitore,
            urlListino,
            formatoFile,
            tipoAccesso,
            username,
            passwordEncrypted,
            frequenzaAggiornamento: frequenzaAggiornamento || 'daily',
            cronExpression,
            encoding: encoding || 'UTF-8',
            separatoreCSV: separatoreCSV || ';',
            ftpHost,
            port: ftpPort ? parseInt(String(ftpPort)) : null,
            ftpDirectory
        }
    });

    logger.info(`Fornitore creato per utente ${utenteId}: ${nomeFornitore}`);

    res.status(201).json({
        success: true,
        data: {
            ...fornitore,
            passwordEncrypted: fornitore.passwordEncrypted ? '***' : null
        }
    });
});

/**
 * PUT /api/fornitori/:id
 */
export const updateFornitore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const updateData: any = { ...req.body };

    if (updateData.password) {
        updateData.passwordEncrypted = encrypt(updateData.password);
    }
    delete updateData.password;
    delete updateData.utenteId; // Non permettere il cambio proprietario

    if (updateData.ftpPort) {
        updateData.port = parseInt(String(updateData.ftpPort));
        delete updateData.ftpPort;
    }

    const fornitore = await prisma.fornitore.update({
        where: { id: parseInt(id), utenteId } as any, // Cast per bypassare limite unique su where
        data: updateData
    });

    res.json({
        success: true,
        data: {
            ...fornitore,
            passwordEncrypted: fornitore.passwordEncrypted ? '***' : null
        }
    });
});

/**
 * DELETE /api/fornitori/:id
 */
export const deleteFornitore = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const fornitoreId = parseInt(id);

    const fornitore = await prisma.fornitore.findFirst({ where: { id: fornitoreId, utenteId } });
    if (!fornitore) throw new AppError('Accesso negato', 403);

    await prisma.$transaction(async (tx) => {
        await tx.listinoRaw.deleteMany({ where: { fornitoreId } });
        await tx.mappaturaCampo.deleteMany({ where: { fornitoreId } });
        await tx.mappaturaCategoria.deleteMany({ where: { fornitoreId } });
        await tx.supplierFilter.deleteMany({ where: { fornitoreId } });

        const masterFileIds = await tx.masterFile.findMany({
            where: { fornitoreSelezionatoId: fornitoreId },
            select: { id: true }
        });
        const masterFileIdList = masterFileIds.map(mf => mf.id);

        if (masterFileIdList.length > 0) {
            await tx.datiIcecat.deleteMany({ where: { masterFileId: { in: masterFileIdList } } });
            await tx.outputShopify.deleteMany({ where: { masterFileId: { in: masterFileIdList } } });
            await tx.masterFile.deleteMany({ where: { fornitoreSelezionatoId: fornitoreId } });
        }

        await tx.regolaMarkup.deleteMany({ where: { fornitoreId } });
        await tx.fornitore.delete({ where: { id: fornitoreId } });
    });

    res.json({ success: true, message: 'Fornitore eliminato' });
});

/**
 * Altri metodi rimangono simili ma aggiungiamo il check utenteId ove necessario
 */
export const testConnection = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    const fornitore = await prisma.fornitore.findFirst({
        where: { id: parseInt(id), utenteId }
    });

    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    try {
        let testResult: any = { success: false };
        switch (fornitore.tipoAccesso) {
            case 'direct_url':
            case 'http_auth':
                const axiosConfig: any = {
                    timeout: 40000, // Timeout esteso per Cometa
                    validateStatus: (status: number) => status < 500,
                    responseType: 'stream',
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*'
                    }
                };
                if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                    const password = decrypt(fornitore.passwordEncrypted);
                    axiosConfig.auth = { username: fornitore.username, password };
                }
                const response = await axios.get(fornitore.urlListino || '', axiosConfig);
                testResult = { success: response.status === 200, statusCode: response.status };

                // Chiudi subito lo stream, ci serviva solo sapere se risponde 200
                if (response.data && response.data.destroy) {
                    response.data.destroy();
                }
                break;
            case 'ftp':
                if (!fornitore.ftpHost) break;
                const { FTPService } = await import('../services/FTPService');
                const ftpPassword = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
                testResult = await FTPService.testConnection({
                    host: fornitore.ftpHost.trim(),
                    port: fornitore.ftpPort || 21,
                    user: fornitore.username || 'anonymous',
                    password: ftpPassword,
                    directory: fornitore.ftpDirectory || undefined
                });
                break;
        }
        res.json({ success: true, data: testResult });
    } catch (error: any) {
        res.json({ success: false, error: error.message });
    }
});

export const previewListino = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const { rows = 5 } = req.query;

    const fornitore = await prisma.fornitore.findFirst({
        where: { id: parseInt(id), utenteId }
    });

    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    // Logica preview immutata ma castata se serve
    // Per brevità usiamo la logica esistente ma assicuriamoci di aver filtrato per proprietario sopra
    const { previewListinoInternal } = await import('../utils/preview-logic');
    const result = await previewListinoInternal(fornitore, parseInt(String(rows)));
    res.json({ success: true, data: result });
});

export const getImportStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const fornitore = await prisma.fornitore.findFirst({ where: { id: parseInt(id), utenteId } });
    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    const lastLog = await (prisma.logElaborazione as any).findFirst({
        where: { utenteId, faseProcesso: `IMPORT_${fornitore.nomeFornitore}` },
        orderBy: { dataEsecuzione: 'desc' }
    });

    res.json({ success: true, data: lastLog });
});

export const importListino = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const fornitoreId = parseInt(id);

    const fornitore = await prisma.fornitore.findFirst({ where: { id: fornitoreId, utenteId } });
    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    setImmediate(async () => {
        try {
            await ImportService.importaListino(utenteId, fornitoreId);
            const { MasterFileService } = await import('../services/MasterFileService');
            await MasterFileService.consolidaMasterFile(utenteId);
        } catch (err) {
            logger.error(`[IMPORT CONTROLLER] Error: ${err.message}`);
        }
    });

    return res.json({ success: true, message: 'Importazione avviata' });
});

export const importAllListini = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    setImmediate(async () => {
        try {
            await ImportService.importAllListini(utenteId);
            const { MasterFileService } = await import('../services/MasterFileService');
            await MasterFileService.consolidaMasterFile(utenteId);
        } catch (err) {
            logger.error(`[IMPORT ALL CONTROLLER] Error: ${err.message}`);
        }
    });
    res.json({ success: true, message: 'Importazione massiva avviata' });
});

// Altri helper necessari (getFilterOptions, ecc) mantenuti ma con check proprietario
export const getFilterOptions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const fornitoreId = parseInt(id);

    const fornitore = await prisma.fornitore.findFirst({ where: { id: fornitoreId, utenteId } });
    if (!fornitore) throw new AppError('Negato', 403);

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    const options = await supplierFilterService.getAvailableOptions(utenteId, fornitoreId);
    res.json({ success: true, data: options });
});

export const getSupplierFilter = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;

    const fornitore = await prisma.fornitore.findFirst({ where: { id: parseInt(id), utenteId } });
    if (!fornitore) throw new AppError('Negato', 403);

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    const filter = await supplierFilterService.getActiveFilter(utenteId, parseInt(id));
    res.json({ success: true, data: filter });
});

export const upsertSupplierFilter = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const utenteId = req.utenteId;
    const { nome, config, note } = req.body;

    const fornitore = await prisma.fornitore.findFirst({ where: { id: parseInt(id), utenteId } });
    if (!fornitore) throw new AppError('Negato', 403);

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    const filter = await supplierFilterService.upsertFilter(utenteId, parseInt(id), nome, config, note);
    res.status(201).json({ success: true, data: filter });
});

export const deleteSupplierFilter = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { filterId } = req.params;
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const fId = parseInt(filterId);

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    await supplierFilterService.deleteFilter(utenteId, fId);
    res.json({ success: true, message: 'Filtro eliminato' });
});
