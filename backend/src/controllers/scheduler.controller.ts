import { Request, Response } from 'express';
import { SchedulerService } from '../services/SchedulerService';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';

export const getStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = SchedulerService.getStatus();

    // Recupera ultimi log
    const logs = await prisma.logElaborazione.findMany({
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

export const runWorkflow = asyncHandler(async (req: Request, res: Response) => {
    // Avvia in background senza attendere completamento
    SchedulerService.runFullWorkflow();

    res.json({
        success: true,
        message: 'Workflow avviato in background'
    });
});


export const getSchedules = asyncHandler(async (req: Request, res: Response) => {
    const schedules = await SchedulerService.getSchedules();
    res.json({ success: true, data: schedules });
});

export const addSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { expression } = req.body;
    if (!expression) {
        res.status(400).json({ success: false, error: 'Expression is required' });
        return;
    }

    try {
        const added = await SchedulerService.addSchedule(expression);
        if (added) {
            res.json({ success: true, message: 'Schedule added' });
        } else {
            res.status(409).json({ success: false, message: 'Schedule already exists' });
        }
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});

export const removeSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { expression } = req.body;
    if (!expression) {
        res.status(400).json({ success: false, error: 'Expression is required' });
        return;
    }

    const removed = await SchedulerService.removeSchedule(expression);
    if (removed) {
        res.json({ success: true, message: 'Schedule removed' });
    } else {
        res.status(404).json({ success: false, message: 'Schedule not found' });
    }
});
