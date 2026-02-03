// @ts-nocheck
import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * GET /api/settings/profile
 * Ottiene i dati del profilo e le impostazioni
 */
export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const utenteId = req.utenteId || 1;
        const isAdmin = utenteId === 1 || req.user?.ruolo === 'admin';

        logger.info(`[Settings] Caricamento profilo per utente ${utenteId} (Admin: ${isAdmin})`);

        const user = await prisma.utente.findUnique({
            where: { id: utenteId }
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'Utente non trovato' });
        }

        // Recupera impostazioni personali (usiamo any per evitare problemi di tipo se prisma generate è disallineato)
        const personalConfigs = await (prisma.configurazioneSistema as any).findMany({
            where: { utenteId }
        });

        // Se admin, recupera anche impostazioni globali (AI)
        let globalConfigs: any[] = [];
        if (isAdmin) {
            globalConfigs = await (prisma.configurazioneSistema as any).findMany({
                where: { utenteId: null }
            });
        }

        const settings: Record<string, string> = {};

        // Mappa impostazioni personali
        personalConfigs.forEach((c: any) => {
            if (c.chiave) settings[c.chiave] = c.valore;
        });

        // Se admin, aggiunge/sovrascrive con quelle globali
        if (isAdmin) {
            globalConfigs.forEach((c: any) => {
                if (c.chiave) settings[c.chiave] = c.valore;
            });
        }

        // Compatibilità con Profile.tsx che si aspetta notificationEmail nel settings
        if (!settings.notificationEmail && settings.notification_email) {
            settings.notificationEmail = settings.notification_email;
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    nome: user.nome,
                    cognome: user.cognome,
                    email: user.email,
                    ruolo: user.ruolo
                },
                settings
            }
        });
    } catch (error: any) {
        logger.error(`[Settings] Errore critico getProfile: ${error.message}`, error);
        res.status(500).json({ success: false, error: 'Errore interno nel caricamento profilo' });
    }
});

/**
 * PUT /api/settings/profile
 * Aggiorna dati profilo e impostazioni
 */
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const utenteId = req.utenteId || 1;
        const { nome, cognome, email, notificationEmail, settings: extraSettings } = req.body;
        const isAdmin = utenteId === 1 || req.user?.ruolo === 'admin';

        logger.info(`[Settings] Aggiornamento profilo per utente ${utenteId}`);

        // 1. Aggiorna utente
        const updatedUser = await prisma.utente.update({
            where: { id: utenteId },
            data: {
                nome: nome || '',
                cognome: cognome || '',
                email: email
            }
        });

        // 2. Aggiorna notificationEmail (se presente nel body flat o in settings)
        const emailToSave = notificationEmail || extraSettings?.notificationEmail;
        if (emailToSave) {
            await (prisma.configurazioneSistema as any).upsert({
                where: { utenteId_chiave: { utenteId, chiave: 'notification_email' } },
                create: { utenteId, chiave: 'notification_email', valore: String(emailToSave), tipo: 'string' },
                update: { valore: String(emailToSave) }
            });
        }

        // 3. Aggiorna extra settings (es. chiavi AI)
        if (extraSettings && typeof extraSettings === 'object') {
            for (const [key, value] of Object.entries(extraSettings)) {
                if (key === 'notificationEmail') continue;

                const isAIKey = ['OPENAI_API_KEY', 'GEMINI_API_KEY'].includes(key);

                // Un'utente normale può salvare le sue chiavi personali.
                // L'admin salva quelle GLOBALI (utenteId null) se agisce sul proprio profilo o tramite rotte admin dedicate
                const targetUtenteId = (isAIKey && isAdmin) ? null : utenteId;

                await (prisma.configurazioneSistema as any).upsert({
                    where: {
                        utenteId_chiave: {
                            utenteId: targetUtenteId,
                            chiave: key
                        }
                    },
                    create: {
                        utenteId: targetUtenteId,
                        chiave: key,
                        valore: String(value),
                        tipo: 'string'
                    },
                    update: {
                        valore: String(value)
                    }
                });
            }
        }

        res.json({
            success: true,
            message: 'Profilo salvato correttamente',
            data: {
                user: {
                    nome: updatedUser.nome,
                    cognome: updatedUser.cognome,
                    email: updatedUser.email
                }
            }
        });
    } catch (error: any) {
        logger.error(`[Settings] Errore critico updateProfile: ${error.message}`, error);
        res.status(500).json({ success: false, error: 'Errore interno nel salvataggio profilo' });
    }
});
