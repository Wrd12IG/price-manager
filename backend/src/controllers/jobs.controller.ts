// @ts-nocheck
import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { jobProgressManager } from '../services/JobProgressService';

/**
 * GET /api/jobs
 * Ottieni tutti i job dell'utente corrente
 */
export const getUserJobs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId!;
    const jobs = jobProgressManager.getJobsByUser(utenteId);

    res.json({
        success: true,
        data: jobs
    });
});

/**
 * GET /api/jobs/active
 * Ottieni solo i job attivi dell'utente
 */
export const getActiveJobs = asyncHandler(async (req: AuthRequest, res: Response) => {
    const utenteId = req.utenteId!;
    const jobs = jobProgressManager.getJobsByUser(utenteId)
        .filter(job => job.status === 'running' || job.status === 'pending');

    res.json({
        success: true,
        data: jobs
    });
});

/**
 * GET /api/jobs/:id
 * Ottieni lo stato di un job specifico
 */
export const getJobStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const job = jobProgressManager.getJob(id);

    if (!job) {
        return res.status(404).json({
            success: false,
            error: 'Job non trovato'
        });
    }

    // Verifica che il job appartenga all'utente
    if (job.metadata?.utenteId !== req.utenteId) {
        return res.status(403).json({
            success: false,
            error: 'Accesso negato'
        });
    }

    res.json({
        success: true,
        data: job
    });
});

/**
 * GET /api/jobs/:id/stream
 * Server-Sent Events per aggiornamenti in tempo reale
 */
export const streamJobUpdates = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const job = jobProgressManager.getJob(id);

    if (!job) {
        return res.status(404).json({
            success: false,
            error: 'Job non trovato'
        });
    }

    // Verifica che il job appartenga all'utente
    if (job.metadata?.utenteId !== req.utenteId) {
        return res.status(403).json({
            success: false,
            error: 'Accesso negato'
        });
    }

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Per Nginx

    // Invia lo stato iniziale
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    // Sottoscrivi agli aggiornamenti
    const unsubscribe = jobProgressManager.subscribe(id, (updatedJob) => {
        res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);

        // Chiudi connessione se job completato o fallito
        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            res.write('event: close\ndata: done\n\n');
            res.end();
            unsubscribe();
        }
    });

    // Gestisci chiusura connessione
    req.on('close', () => {
        unsubscribe();
        res.end();
    });
});
