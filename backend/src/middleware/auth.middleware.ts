import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export type AuthRequest = any;

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token as string;
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Token mancante' });
    }

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.utenteId = decoded.id;
        req.user = decoded;
        next();
    } catch (error) {
        logger.error('JWT Verification Error:', error);
        return res.status(401).json({ success: false, error: 'Token non valido o scaduto' });
    }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || (req.user.ruolo !== 'admin' && req.utenteId !== 1)) {
        return res.status(403).json({ success: false, error: 'Accesso negato - Solo per amministratori' });
    }
    next();
};
