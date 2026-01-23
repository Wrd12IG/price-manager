import { Request, Response } from 'express';
import prisma from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import axios from 'axios';
import { ImportService } from '../services/ImportService';
import { FileParserService } from '../services/FileParserService';

/**
 * GET /api/fornitori
 * Ottieni tutti i fornitori
 */
export const getAllFornitori = asyncHandler(async (req: Request, res: Response) => {
    const fornitori = await prisma.fornitore.findMany({
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
 * Ottieni un fornitore specifico
 */
export const getFornitoreById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const fornitore = await prisma.fornitore.findUnique({
        where: { id: parseInt(id) },
        include: {
            mappatureCampi: true,
            mappatureCategorie: true,
            _count: {
                select: { listiniRaw: true }
            }
        }
    });

    if (!fornitore) {
        throw new AppError('Fornitore non trovato', 404);
    }

    // Rimuovi password criptata
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
 * Crea nuovo fornitore
 */
export const createFornitore = asyncHandler(async (req: Request, res: Response) => {
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
        separatoreCSV
    } = req.body;

    // Validazione
    if (!nomeFornitore || !formatoFile || !tipoAccesso) {
        throw new AppError('Campi obbligatori mancanti', 400);
    }

    // Cripta password se presente
    const passwordEncrypted = password ? encrypt(password) : null;

    const fornitore = await prisma.fornitore.create({
        data: {
            nomeFornitore,
            urlListino,
            formatoFile,
            tipoAccesso,
            username,
            passwordEncrypted,
            frequenzaAggiornamento: frequenzaAggiornamento || 'daily',
            cronExpression,
            encoding: encoding || 'UTF-8',
            separatoreCSV: separatoreCSV || ';'
        }
    });

    logger.info(`Fornitore creato: ${nomeFornitore}`, { id: fornitore.id });

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
 * Aggiorna fornitore
 */
export const updateFornitore = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: any = { ...req.body };

    // Cripta nuova password se presente
    if (updateData.password) {
        updateData.passwordEncrypted = encrypt(updateData.password);
    }
    // Rimuovi sempre il campo password plain text perché non esiste nel DB
    delete updateData.password;

    const fornitore = await prisma.fornitore.update({
        where: { id: parseInt(id) },
        data: updateData
    });

    logger.info(`Fornitore aggiornato: ${fornitore.nomeFornitore}`, { id: fornitore.id });

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
 * Elimina fornitore e tutti i dati correlati
 */
export const deleteFornitore = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitoreId = parseInt(id);

    // Elimina in una transazione per garantire consistenza
    await prisma.$transaction(async (tx) => {
        // 1. Elimina listini raw
        await tx.listinoRaw.deleteMany({
            where: { fornitoreId }
        });

        // 2. Elimina mappature campi
        await tx.mappaturaCampo.deleteMany({
            where: { fornitoreId }
        });

        // 3. Elimina mappature categorie
        await tx.mappaturaCategoria.deleteMany({
            where: { fornitoreId }
        });

        // 4. Trova tutti i MasterFile di questo fornitore
        const masterFileIds = await tx.masterFile.findMany({
            where: { fornitoreSelezionatoId: fornitoreId },
            select: { id: true }
        });

        const masterFileIdList = masterFileIds.map(mf => mf.id);

        // 5. Elimina dati correlati ai MasterFile
        if (masterFileIdList.length > 0) {
            // Elimina DatiIcecat
            await tx.datiIcecat.deleteMany({
                where: { masterFileId: { in: masterFileIdList } }
            });

            // Elimina OutputShopify
            await tx.outputShopify.deleteMany({
                where: { masterFileId: { in: masterFileIdList } }
            });

            // Elimina MasterFile
            await tx.masterFile.deleteMany({
                where: { fornitoreSelezionatoId: fornitoreId }
            });
        }

        // 6. Elimina regole markup specifiche del fornitore
        await tx.regolaMarkup.deleteMany({
            where: { fornitoreId }
        });

        // 7. Infine elimina il fornitore
        await tx.fornitore.delete({
            where: { id: fornitoreId }
        });
    });

    logger.info(`Fornitore e dati correlati eliminati`, { id });

    res.json({
        success: true,
        message: 'Fornitore eliminato con successo'
    });
});

/**
 * POST /api/fornitori/:id/test-connection
 * Testa connessione al fornitore
 */
export const testConnection = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const fornitore = await prisma.fornitore.findUnique({
        where: { id: parseInt(id) }
    });

    if (!fornitore) {
        throw new AppError('Fornitore non trovato', 404);
    }

    try {
        let testResult: any = { success: false };

        switch (fornitore.tipoAccesso) {
            case 'direct_url':
            case 'http_auth':
                // Test HTTP connection
                const axiosConfig: any = {
                    timeout: 10000,
                    validateStatus: (status: number) => status < 500
                };

                if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                    const password = decrypt(fornitore.passwordEncrypted);
                    axiosConfig.auth = {
                        username: fornitore.username,
                        password
                    };
                }

                const response = await axios.get(fornitore.urlListino || '', axiosConfig);

                testResult = {
                    success: response.status === 200,
                    statusCode: response.status,
                    contentType: response.headers['content-type'],
                    contentLength: response.headers['content-length']
                };
                break;

            case 'ftp':
                // Test FTP connection
                if (!fornitore.ftpHost) {
                    testResult = {
                        success: false,
                        message: 'FTP Host non configurato'
                    };
                    break;
                }

                const { FTPService } = await import('../services/FTPService');
                const ftpPassword = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';

                const ftpTest = await FTPService.testConnection({
                    host: fornitore.ftpHost.trim(), // TRIM to remove spaces!
                    port: fornitore.ftpPort || 21,
                    user: fornitore.username || 'anonymous',
                    password: ftpPassword,
                    directory: fornitore.ftpDirectory || undefined
                });

                testResult = ftpTest;
                break;

            case 'api':
                testResult = {
                    success: false,
                    message: 'Test non ancora implementato per API'
                };
                break;
        }

        res.json({
            success: true,
            data: testResult
        });

    } catch (error: any) {
        logger.error('Errore test connessione', { fornitoreId: id, error: error.message });

        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/fornitori/:id/preview
 * Scarica e mostra anteprima del listino
 */
export const previewListino = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rows = 5 } = req.query;

    const fornitore = await prisma.fornitore.findUnique({
        where: { id: parseInt(id) }
    });

    if (!fornitore) {
        throw new AppError('Fornitore non trovato', 404);
    }

    if (!fornitore.urlListino && fornitore.tipoAccesso !== 'ftp') {
        throw new AppError('URL listino non configurato per questo fornitore', 400);
    }

    if (fornitore.tipoAccesso === 'ftp' && (!fornitore.ftpHost || !fornitore.ftpDirectory)) {
        throw new AppError('Configurazione FTP incompleta', 400);
    }

    try {
        let result: any;

        if (fornitore.tipoAccesso === 'ftp') {
            // FTP: Scarica file specifici e uniscili
            const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';

            logger.info(`Scaricamento file FTP per preview: ${fornitore.nomeFornitore}`);

            // Usa RunnerFTPService per Runner, altrimenti usa la logica generica
            let mergedRows: any[];

            if (fornitore.nomeFornitore === 'Runner') {
                const { RunnerFTPService } = await import('../services/RunnerFTPService');

                mergedRows = await RunnerFTPService.downloadAndMergeRunnerFiles({
                    host: fornitore.ftpHost!,
                    port: fornitore.ftpPort || 21,
                    user: fornitore.username || 'anonymous',
                    password
                });
            } else {
                // Logica generica per altri fornitori FTP (es. Cometa)
                const { FTPService } = await import('../services/FTPService');
                const { PassThrough } = await import('stream');

                const fileList = await FTPService.listFiles({
                    host: fornitore.ftpHost!,
                    port: fornitore.ftpPort || 21,
                    user: fornitore.username || 'anonymous',
                    password,
                    directory: fornitore.ftpDirectory || '/'
                });

                const firstFile = fileList.find(f => f.isFile && (f.name.endsWith('.csv') || f.name.endsWith('.txt')));
                if (!firstFile) throw new AppError('Nessun file CSV/TXT trovato nella directory FTP', 404);

                logger.info(`Preview FTP: Utilizzo file ${firstFile.name}`);

                const stream = new PassThrough();
                const limitRows = parseInt(String(rows)) || 10;

                FTPService.downloadToStream({
                    host: fornitore.ftpHost!,
                    port: fornitore.ftpPort || 21,
                    user: fornitore.username || 'anonymous',
                    password,
                    directory: fornitore.ftpDirectory || '/',
                    filename: firstFile.name
                }, stream).catch(err => {
                    logger.error(`Errore download streaming FTP: ${err.message}`);
                    stream.destroy();
                });

                const parseResult = await FileParserService.parseFile({
                    format: fornitore.formatoFile,
                    stream: stream,
                    encoding: fornitore.encoding,
                    csvSeparator: fornitore.separatoreCSV,
                    previewRows: limitRows
                });

                result = {
                    headers: parseResult.headers,
                    rows: parseResult.rows,
                    totalRows: parseResult.totalRows,
                    previewRows: limitRows
                };
            }
        } else {
            // HTTP: Download singolo file
            const axiosConfig: any = {
                responseType: 'arraybuffer',
                timeout: 60000, // Aumentato a 60s
                validateStatus: (status: number) => status < 500
            };

            if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                try {
                    const password = decrypt(fornitore.passwordEncrypted);
                    axiosConfig.auth = {
                        username: fornitore.username,
                        password
                    };
                } catch (e) {
                    logger.error(`Errore decriptazione password fornitore ${id}`, e);
                    throw new AppError('Errore configurazione credenziali', 500);
                }
            }

            logger.info(`Preview: Inizio download in streaming da ${fornitore.urlListino}`);

            const response = await axios({
                method: 'GET',
                url: fornitore.urlListino!,
                responseType: 'stream',
                timeout: 30000
            });

            // Parsing in streaming: si ferma non appena ha le righe necessarie
            const limitRows = parseInt(String(rows)) || 10;
            const parseResult = await FileParserService.parseFile({
                format: fornitore.formatoFile,
                stream: response.data,
                encoding: fornitore.encoding,
                csvSeparator: fornitore.separatoreCSV,
                previewRows: limitRows
            });

            // Chiudiamo la connessione axios se il parser non l'ha già fatto
            if (response.data && typeof response.data.destroy === 'function') {
                response.data.destroy();
            }

            logger.info(`Preview: Streaming completato. Estratte ${parseResult.rows.length} righe.`);

            result = {
                headers: parseResult.headers,
                rows: parseResult.rows,
                totalRows: parseResult.totalRows,
                previewRows: limitRows
            };
        }

        res.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        logger.error(`Errore preview listino fornitore ${id}:`, error);
        // Assicuriamoci di restituire un JSON valido anche in caso di errore
        if (!res.headersSent) {
            res.status(error instanceof AppError ? error.statusCode : 500).json({
                success: false,
                error: error.message || 'Errore interno del server'
            });
        }
    }
});

/**
 * GET /api/fornitori/:id/import-status
 * Ottiene lo stato dell'ultima importazione per un fornitore
 */
export const getImportStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitore = await prisma.fornitore.findUnique({ where: { id: parseInt(id) } });

    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    const lastLog = await prisma.logElaborazione.findFirst({
        where: { faseProcesso: `IMPORT_${fornitore.nomeFornitore}` },
        orderBy: { dataEsecuzione: 'desc' }
    });

    res.json({
        success: true,
        data: lastLog
    });
});

/**
 * POST /api/fornitori/:id/import
 * Avvia importazione manuale del listino
 */
export const importListino = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitoreId = parseInt(id);

    logger.info(`[CONTROLLER] Received import request for supplier ${fornitoreId}`);

    // Check if supplier exists first (fast)
    const fornitore = await prisma.fornitore.findUnique({ where: { id: fornitoreId } });
    if (!fornitore) throw new AppError('Fornitore non trovato', 404);

    // Start background task
    setImmediate(() => {
        ImportService.importaListino(fornitoreId).catch(err => {
            logger.error(`[BACKGROUND CRASH] Fornitore ${fornitoreId}: ${err.message}`);
        });
    });

    // Immediate success response
    return res.json({
        success: true,
        message: 'Importazione avviata in background. Segui il progresso dal log.',
        data: { total: 0, inserted: 0, errors: 0, status: 'started' } // Fake stats to keep frontend happy
    });
});


/**
 * POST /api/fornitori/import-all
 * Avvia importazione massiva di tutti i fornitori attivi
 */
export const importAllListini = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Avvio importazione massiva via API');

    // Non attendiamo (no await)
    ImportService.importAllListini().catch(err => {
        logger.error('Errore durante importazione massiva background:', err);
    });

    res.json({
        success: true,
        message: 'Importazione massiva avviata in background.',
        data: { status: 'started' }
    });
});


/**
 * GET /api/fornitori/:id/filter-options
 * Ottiene marche e categorie disponibili per un fornitore specifico
 */
export const getFilterOptions = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitoreId = parseInt(id);

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    const options = await supplierFilterService.getAvailableOptions(fornitoreId);

    res.json({
        success: true,
        data: options
    });
});

/**
 * GET /api/fornitori/:id/filter
 * Ottiene il filtro attivo per un fornitore
 */
export const getSupplierFilter = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitoreId = parseInt(id);

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    const filter = await supplierFilterService.getActiveFilter(fornitoreId);

    res.json({
        success: true,
        data: filter
    });
});

/**
 * POST /api/fornitori/:id/filter
 * Crea o aggiorna il filtro per un fornitore
 */
export const upsertSupplierFilter = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const fornitoreId = parseInt(id);
    const { nome, config, note } = req.body;

    if (!nome || !config) {
        throw new AppError('Nome e configurazione filtro sono obbligatori', 400);
    }

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    const filter = await supplierFilterService.upsertFilter(fornitoreId, nome, config, note);

    res.status(201).json({
        success: true,
        data: filter,
        message: 'Filtro salvato con successo'
    });
});

/**
 * DELETE /api/fornitori/filters/:filterId
 * Elimina un filtro fornitore
 */
export const deleteSupplierFilter = asyncHandler(async (req: Request, res: Response) => {
    const { filterId } = req.params;

    const { supplierFilterService } = await import('../services/SupplierFilterService');
    await supplierFilterService.deleteFilter(parseInt(filterId));

    res.json({
        success: true,
        message: 'Filtro eliminato con successo'
    });
});
