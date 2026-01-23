import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Crea directory logs se non esiste
const logDir = path.resolve(process.cwd(), process.env.LOG_DIR || './logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Utility per stringificare oggetti con riferimenti circolari in modo sicuro
 */
const safeStringify = (obj: any): string => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
        }
        return value;
    }, 2);
};

// Definisci formato log
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Formato console per development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            try {
                // Rimuoviamo oggetti potenzialmente circolari o troppo grandi che non vogliamo nei log console
                const cleanMeta = { ...meta };
                if (cleanMeta.error && typeof cleanMeta.error !== 'string') {
                    cleanMeta.error = (cleanMeta.error as any).message || String(cleanMeta.error);
                }
                msg += ` ${JSON.stringify(cleanMeta)}`;
            } catch (e) {
                // Fallback su safeStringify se JSON.stringify standard fallisce
                msg += ` [Circular Data]`;
            }
        }
        return msg;
    })
);

// Crea logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
    transports: [
        new winston.transports.Console()
    ],
    exitOnError: false
});

export const logProcessStart = (processName: string, details?: any) => {
    logger.info(`🚀 Inizio processo: ${processName}`, details);
};

export const logProcessEnd = (processName: string, duration: number, details?: any) => {
    logger.info(`✅ Fine processo: ${processName} (${duration}s)`, details);
};

export const logProcessError = (processName: string, error: any, details?: any) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`❌ Errore processo: ${processName}`, {
        error: errorMsg,
        stack: errorStack,
        ...details
    });
};
