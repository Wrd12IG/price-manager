import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
    utenteId?: number;
    user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token mancante' });
    }

    const token = authHeader.split(' ')[1];

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
