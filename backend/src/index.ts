import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { rateLimit } from 'express-rate-limit';
import { logger } from './utils/logger';
import { SchedulerService } from './services/SchedulerService';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import fornitoriRoutes from './routes/fornitori.routes';
import mappatureRoutes from './routes/mappature.routes';
import markupRoutes from './routes/markup.routes';
import masterFileRoutes from './routes/masterFile.routes';
import icecatRoutes from './routes/icecat.routes';
import shopifyRoutes from './routes/shopify.routes';
import schedulerRoutes from './routes/scheduler.routes';
import catalogRoutes from './routes/catalog.routes';
import logRoutes from './routes/log.routes';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import filtersRoutes from './routes/filters';
import marchiRoutes from './routes/marchi.routes';
import categorieRoutes from './routes/categorie.routes';
import settingsRoutes from './routes/settings.routes';
import aiRoutes from './routes/ai.routes';
import normalizationRoutes from './routes/normalization.routes';

// Load environment variables
dotenv.config();



const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disabilitato per facilitare il testing iniziale
}));

// CORS - Configurazione completa per Safari e altri browser
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://pricemanager.wrdigital.it',
            'https://api.pricemanager.wrdigital.it'
        ];
        // Safari a volte invia richieste senza origin
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400 // Cache preflight per 24h
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// RATE LIMITING DIFFERENZIATO
// ============================================

// Rate limiter per login (anti brute-force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 10, // Max 10 tentativi login per 15 min
    message: { error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter per import (operazioni pesanti)
const importLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 20, // Max 20 import all'ora
    message: { error: 'Limite importazioni raggiunto. Riprova tra un\'ora.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter standard per API generiche
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 200, // 200 richieste per 15 min
    message: { error: 'Troppe richieste. Riprova più tardi.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Applica rate limiters specifici
app.use('/api/auth/login', authLimiter);
app.use('/api/fornitori/*/import', importLimiter);
app.use('/api/scheduler/run', importLimiter);
app.use('/api/', generalLimiter);

// ============================================
// ENHANCED REQUEST LOGGING
// ============================================
app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            ip: req.ip,
            userAgent: req.get('user-agent'),
            statusCode: res.statusCode,
            durationMs: duration
        };

        // Log con livello appropriato
        if (res.statusCode >= 500) {
            logger.error(`${req.method} ${req.path}`, logData);
        } else if (res.statusCode >= 400) {
            logger.warn(`${req.method} ${req.path}`, logData);
        } else {
            logger.info(`${req.method} ${req.path}`, logData);
        }
    });

    next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

import adminRoutes from './routes/admin.routes';
import jobsRoutes from './routes/jobs.routes';

// ... (existing imports skipped in concept but present in real file)

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/fornitori', fornitoriRoutes);
app.use('/api/mappature', mappatureRoutes);
app.use('/api/markup', markupRoutes);
app.use('/api/master-file', masterFileRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/icecat', icecatRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/filters', filtersRoutes);
app.use('/api/marchi', marchiRoutes);
app.use('/api/categorie', categorieRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/normalization', normalizationRoutes);

// Static files (Se presenti)
const publicPath = path.join(__dirname, '../public');
if (require('fs').existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get('*', (req, res, next) => {
        if (!req.path.startsWith('/api/')) {
            res.sendFile(path.join(publicPath, 'index.html'));
        } else {
            next();
        }
    });
}

// API 404 handler
app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
        error: 'Endpoint API non trovato',
        path: req.path
    });
});

// Error handler (deve essere l'ultimo middleware)
app.use(errorHandler);

// ============================================
// SERVER START
// ============================================

// Inizializza Scheduler
SchedulerService.init();

app.listen(PORT, () => {
    logger.info(`🚀 Server avviato su porta ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM ricevuto, chiusura server...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT ricevuto, chiusura server...');
    process.exit(0);
});

export default app;
// force rebuild 1769179085
