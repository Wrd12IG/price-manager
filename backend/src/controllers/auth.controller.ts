// @ts-nocheck
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/AuthService';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

/**
 * POST /api/auth/register
 * Registra un nuovo Merchant
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const { nome, cognome, email, password } = req.body;

    const existingUser = await prisma.utente.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(400).json({ success: false, error: 'Email già registrata' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.utente.create({
        data: { nome, cognome, email, passwordHash, ruolo: 'merchant' }
    });

    logger.info('Nuovo utente registrato', { userId: user.id, email: user.email });

    res.status(201).json({
        success: true,
        message: 'Registrazione completata. Ora puoi effettuare il login.',
        data: { id: user.id, email: user.email, ruolo: user.ruolo }
    });
});

/**
 * POST /api/auth/login
 * Login con access token + refresh token
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await prisma.utente.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        logger.warn('Login fallito', { email, reason: 'credenziali invalide' });
        return res.status(401).json({ success: false, error: 'Credenziali non valide' });
    }

    if (!user.attivo) {
        logger.warn('Login fallito', { email, reason: 'account disattivato' });
        return res.status(403).json({ success: false, error: 'Account disattivato. Contatta l\'amministratore.' });
    }

    // Genera tokens
    const accessToken = AuthService.generateAccessToken({
        id: user.id,
        email: user.email,
        ruolo: user.ruolo
    });
    const refreshToken = await AuthService.generateRefreshToken(user.id);

    // Aggiorna ultimo accesso
    await prisma.utente.update({
        where: { id: user.id },
        data: { ultimoAccesso: new Date() }
    });

    logger.info('Login effettuato', { userId: user.id, email: user.email });

    res.json({
        success: true,
        token: accessToken,  // Per retrocompatibilità
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            nome: user.nome,
            cognome: user.cognome,
            email: user.email,
            ruolo: user.ruolo
        }
    });
});

/**
 * POST /api/auth/refresh
 * Rinnova access token usando refresh token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ success: false, error: 'Refresh token mancante' });
    }

    const result = await AuthService.refreshAccessToken(refreshToken);

    if (!result) {
        return res.status(401).json({ success: false, error: 'Token non valido o scaduto. Effettua nuovamente il login.' });
    }

    res.json({
        success: true,
        accessToken: result.accessToken,
        user: result.user
    });
});

/**
 * POST /api/auth/logout
 * Invalida refresh token
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (refreshToken) {
        await AuthService.revokeRefreshToken(refreshToken);
    }

    res.json({ success: true, message: 'Logout effettuato' });
});

/**
 * POST /api/auth/logout-all
 * Invalida tutti i refresh token (logout da tutti i dispositivi)
 */
export const logoutAll = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.utenteId;

    if (!userId) {
        return res.status(401).json({ success: false, error: 'Non autenticato' });
    }

    const count = await AuthService.revokeAllUserTokens(userId);
    logger.info('Logout da tutti i dispositivi', { userId, revokedTokens: count });

    res.json({ success: true, message: `Disconnesso da ${count} dispositivi` });
});

/**
 * POST /api/auth/forgot-password
 * Richiede reset password (invia email)
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email richiesta' });
    }

    const token = await AuthService.generatePasswordResetToken(email);

    // Nota: In produzione, qui invieresti un'email con il link di reset
    // Per ora, logghiamo il token (in dev) o lo restituiamo per test
    if (token) {
        logger.info('Password reset richiesto', { email });

        // In produzione, invia email qui
        // await EmailService.sendPasswordResetEmail(email, token);

        // Per sviluppo, restituisci il link (RIMUOVERE IN PRODUZIONE!)
        const resetLink = `https://pricemanager.wrdigital.it/reset-password?token=${token}`;
        console.log(`[DEV] Reset link: ${resetLink}`);
    }

    // Risposta sempre positiva per non rivelare se l'email esiste
    res.json({
        success: true,
        message: 'Se l\'email è registrata, riceverai un link per reimpostare la password.'
    });
});

/**
 * POST /api/auth/reset-password
 * Resetta la password con il token
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Token e nuova password richiesti' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'La password deve essere di almeno 8 caratteri' });
    }

    const success = await AuthService.resetPassword(token, newPassword);

    if (!success) {
        return res.status(400).json({ success: false, error: 'Token non valido, scaduto o già utilizzato' });
    }

    res.json({
        success: true,
        message: 'Password reimpostata con successo. Ora puoi effettuare il login.'
    });
});

/**
 * GET /api/auth/me
 * Restituisce info utente corrente
 */
export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.utenteId;

    if (!userId) {
        return res.status(401).json({ success: false, error: 'Non autenticato' });
    }

    const user = await prisma.utente.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            nome: true,
            cognome: true,
            ruolo: true,
            ultimoAccesso: true,
            createdAt: true
        }
    });

    if (!user) {
        return res.status(404).json({ success: false, error: 'Utente non trovato' });
    }

    res.json({ success: true, data: user });
});
