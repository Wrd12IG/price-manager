// @ts-nocheck
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minuti
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

interface TokenPayload {
    id: number;
    email: string;
    ruolo: string;
}

export class AuthService {

    /**
     * Genera access token (breve durata)
     */
    static generateAccessToken(user: { id: number; email: string; ruolo: string }): string {
        return jwt.sign(
            { id: user.id, email: user.email, ruolo: user.ruolo },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRY }
        );
    }

    /**
     * Genera e salva refresh token (lunga durata)
     */
    static async generateRefreshToken(userId: number): Promise<string> {
        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

        // Rimuovi vecchi refresh token per questo utente (max 5 dispositivi)
        const existingTokens = await prisma.refreshToken.findMany({
            where: { utenteId: userId },
            orderBy: { createdAt: 'desc' }
        });

        if (existingTokens.length >= 5) {
            const oldTokenIds = existingTokens.slice(4).map(t => t.id);
            await prisma.refreshToken.deleteMany({
                where: { id: { in: oldTokenIds } }
            });
        }

        await prisma.refreshToken.create({
            data: {
                token,
                utenteId: userId,
                expiresAt
            }
        });

        return token;
    }

    /**
     * Verifica refresh token e genera nuovo access token
     */
    static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; user: any } | null> {
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { utente: true }
        });

        if (!storedToken) {
            logger.warn('Refresh token non trovato');
            return null;
        }

        if (new Date() > storedToken.expiresAt) {
            // Token scaduto, eliminalo
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            logger.warn('Refresh token scaduto');
            return null;
        }

        if (!storedToken.utente.attivo) {
            logger.warn('Utente disattivato tenta refresh');
            return null;
        }

        const accessToken = this.generateAccessToken({
            id: storedToken.utente.id,
            email: storedToken.utente.email,
            ruolo: storedToken.utente.ruolo
        });

        return {
            accessToken,
            user: {
                id: storedToken.utente.id,
                email: storedToken.utente.email,
                nome: storedToken.utente.nome,
                cognome: storedToken.utente.cognome,
                ruolo: storedToken.utente.ruolo
            }
        };
    }

    /**
     * Invalida refresh token (logout)
     */
    static async revokeRefreshToken(refreshToken: string): Promise<boolean> {
        try {
            await prisma.refreshToken.delete({
                where: { token: refreshToken }
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Invalida tutti i refresh token di un utente (logout da tutti i dispositivi)
     */
    static async revokeAllUserTokens(userId: number): Promise<number> {
        const result = await prisma.refreshToken.deleteMany({
            where: { utenteId: userId }
        });
        return result.count;
    }

    /**
     * Genera token per reset password
     */
    static async generatePasswordResetToken(email: string): Promise<string | null> {
        const user = await prisma.utente.findUnique({ where: { email } });
        if (!user) {
            // Non rivelare se l'email esiste o meno
            return null;
        }

        // Invalida token precedenti
        await prisma.passwordResetToken.updateMany({
            where: { utenteId: user.id, used: false },
            data: { used: true }
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Valido 1 ora

        await prisma.passwordResetToken.create({
            data: {
                token,
                utenteId: user.id,
                expiresAt
            }
        });

        logger.info('Password reset token generato', { userId: user.id });
        return token;
    }

    /**
     * Resetta la password usando il token
     */
    static async resetPassword(token: string, newPassword: string): Promise<boolean> {
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { utente: true }
        });

        if (!resetToken) {
            logger.warn('Reset token non trovato');
            return false;
        }

        if (resetToken.used) {
            logger.warn('Reset token già utilizzato');
            return false;
        }

        if (new Date() > resetToken.expiresAt) {
            logger.warn('Reset token scaduto');
            return false;
        }

        // Hash nuova password
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Aggiorna password e marca token come usato
        await prisma.$transaction([
            prisma.utente.update({
                where: { id: resetToken.utenteId },
                data: { passwordHash }
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used: true }
            }),
            // Invalida tutti i refresh token (forza re-login)
            prisma.refreshToken.deleteMany({
                where: { utenteId: resetToken.utenteId }
            })
        ]);

        logger.info('Password resettata con successo', { userId: resetToken.utenteId });
        return true;
    }

    /**
     * Pulizia token scaduti (da eseguire periodicamente)
     */
    static async cleanupExpiredTokens(): Promise<{ refreshTokens: number; resetTokens: number }> {
        const now = new Date();

        const [refreshResult, resetResult] = await Promise.all([
            prisma.refreshToken.deleteMany({
                where: { expiresAt: { lt: now } }
            }),
            prisma.passwordResetToken.deleteMany({
                where: {
                    OR: [
                        { expiresAt: { lt: now } },
                        { used: true, createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }
                    ]
                }
            })
        ]);

        logger.info('Pulizia token completata', {
            refreshTokens: refreshResult.count,
            resetTokens: resetResult.count
        });

        return {
            refreshTokens: refreshResult.count,
            resetTokens: resetResult.count
        };
    }
}
