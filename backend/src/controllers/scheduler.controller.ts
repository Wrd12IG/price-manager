// @ts-nocheck
import { Response } from 'express';
import { SchedulerService } from '../services/SchedulerService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * GET /api/scheduler/status
 */
export const getStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const status = SchedulerService.getStatus(utenteId);

    // Recupera ultimi log dell'utente
    const logs = await prisma.logElaborazione.findMany({
        where: { utenteId },
        take: 10,
        orderBy: { dataEsecuzione: 'desc' }
    });

    res.json({
        success: true,
        data: {
            status,
            logs
        }
    });
});

/**
 * POST /api/scheduler/run
 */
export const runWorkflow = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    // Avvia in background senza attendere completamento
    SchedulerService.runFullWorkflow(utenteId);

    res.json({
        success: true,
        message: 'Workflow avviato in background'
    });
});

/**
 * GET /api/scheduler/schedules
 */
export const getSchedules = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const schedules = await SchedulerService.getSchedules(utenteId);
    res.json({ success: true, data: schedules });
});

/**
 * POST /api/scheduler/schedules
 */
export const addSchedule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { expression } = req.body;
    if (!expression) {
        res.status(400).json({ success: false, error: 'Expression is required' });
        return;
    }

    try {
        const added = await SchedulerService.addSchedule(utenteId, expression);
        if (added) {
            res.json({ success: true, message: 'Schedule added' });
        } else {
            res.status(409).json({ success: false, message: 'Schedule already exists' });
        }
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

/**
 * DELETE /api/scheduler/schedules
 */
export const removeSchedule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId;
    if (!utenteId) throw new AppError('Non autorizzato', 401);

    const { expression } = req.body;
    if (!expression) {
        res.status(400).json({ success: false, error: 'Expression is required' });
        return;
    }

    const removed = await SchedulerService.removeSchedule(utenteId, expression);
    if (removed) {
        res.json({ success: true, message: 'Schedule removed' });
    } else {
        res.status(404).json({ success: false, message: 'Schedule not found' });
    }
});
