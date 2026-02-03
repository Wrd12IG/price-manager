import { Router } from 'express';
import {
    login,
    register,
    refreshToken,
    logout,
    logoutAll,
    forgotPassword,
    resetPassword,
    getCurrentUser
} from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Autenticazione base
router.post('/login', login);
router.post('/register', register);

// Gestione token
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/logout-all', authMiddleware, logoutAll);

// Password reset
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Info utente
router.get('/me', authMiddleware, getCurrentUser);

export default router;
