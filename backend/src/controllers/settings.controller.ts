import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';

/**
 * GET /api/settings/profile
 * Ottiene i dati del profilo e le impostazioni generali
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    // 1. Recupera o crea Utente di default (Admin)
    let user = await prisma.utente.findFirst();

    if (!user) {
        user = await prisma.utente.create({
            data: {
                nome: 'Admin',
                cognome: 'User',
                email: 'admin@example.com',
                passwordHash: 'placeholder', // TODO: Implement password hashing if needed
                ruolo: 'admin',
                attivo: true
            }
        });
    }

    // 2. Recupera impostazioni notifiche
    const emailConfig = await prisma.configurazioneSistema.findUnique({
        where: { chiave: 'notification_email' }
    });

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
            settings: {
                notificationEmail: emailConfig?.valore || ''
            }
        }
    });
});

/**
 * PUT /api/settings/profile
 * Aggiorna dati profilo e impostazioni
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { nome, cognome, email, notificationEmail } = req.body;

    // 1. Aggiorna primo utente trovato
    const user = await prisma.utente.findFirst();
    let updatedUser = user;

    if (user) {
        updatedUser = await prisma.utente.update({
            where: { id: user.id },
            data: {
                nome,
                cognome,
                email
            }
        });
    }

    // 2. Aggiorna configurazione notifiche
    if (notificationEmail !== undefined) {
        await prisma.configurazioneSistema.upsert({
            where: { chiave: 'notification_email' },
            create: {
                chiave: 'notification_email',
                valore: notificationEmail,
                tipo: 'string',
                descrizione: 'Email destinatario notifiche report'
            },
            update: {
                valore: notificationEmail
            }
        });
    }

    res.json({
        success: true,
        message: 'Profilo salvato correttamente',
        data: {
            user: {
                nome: updatedUser?.nome,
                cognome: updatedUser?.cognome,
                email: updatedUser?.email
            },
            settings: {
                notificationEmail
            }
        }
    });
});
