import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Crea directory logs se non esiste
const logDir = path.resolve(process.cwd(), process.env.LOG_DIR || './logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Formato JSON strutturato per file (produzione)
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

/**
 * Utility per serializzare oggetti in modo sicuro, gestendo riferimenti circolari
 */
const safeStringify = (obj: any, indent = 0) => {
    const cache = new Set();
    const result = JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular Reference]';
            cache.add(value);
        }
        return value;
    }, indent);
    cache.clear();
    return result;
};

// Formato colorato per console (development)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            try {
                const cleanMeta = { ...meta };
                if (cleanMeta.error && typeof cleanMeta.error !== 'string') {
                    cleanMeta.error = (cleanMeta.error as any).message || String(cleanMeta.error);
                }
                // Limita la lunghezza per console usando la versione sicura
                const metaStr = safeStringify(cleanMeta);
                msg += metaStr.length > 200 ? ` ${metaStr.substring(0, 200)}...` : ` ${metaStr}`;
            } catch (e) {
                msg += ` [Complex Data]`;
            }
        }
        return msg;
    })
);

// Transport per file con rotazione automatica (7 giorni retention)
const fileTransport = new DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '7d',
    format: jsonFormat,
    level: 'info'
});

// Transport per errori separati (30 giorni retention)
const errorFileTransport = new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: jsonFormat,
    level: 'error'
});

// Transport per console
const consoleTransport = new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
});

// Determina transports in base all'ambiente
const transports: winston.transport[] = [consoleTransport];

// In produzione, aggiungi file logging
if (process.env.NODE_ENV === 'production') {
    transports.push(fileTransport);
    transports.push(errorFileTransport);
}

// Crea logger principale
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: {
        service: 'price-manager',
        version: '2.0.0'
    },
    transports,
    exitOnError: false
});

// Gestione eventi rotazione
fileTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info('Log file rotated', { oldFilename, newFilename });
});

// ====== HELPER FUNCTIONS ======

/**
 * Log inizio processo con contesto strutturato
 */
export const logProcessStart = (processName: string, details?: Record<string, any>) => {
    logger.info(`🚀 Inizio processo: ${processName}`, {
        event: 'process_start',
        process: processName,
        ...details
    });
};

/**
 * Log fine processo con durata e metriche
 */
export const logProcessEnd = (processName: string, durationSeconds: number, details?: Record<string, any>) => {
    logger.info(`✅ Fine processo: ${processName}`, {
        event: 'process_end',
        process: processName,
        durationSeconds,
        ...details
    });
};

/**
 * Log errore processo con stack trace completo
 */
export const logProcessError = (processName: string, error: any, details?: Record<string, any>) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(`❌ Errore processo: ${processName}`, {
        event: 'process_error',
        process: processName,
        error: errorMsg,
        stack: errorStack,
        ...details
    });
};

/**
 * Log azione utente (audit trail)
 */
export const logUserAction = (utenteId: number, action: string, details?: Record<string, any>) => {
    logger.info(`👤 Azione utente: ${action}`, {
        event: 'user_action',
        utenteId,
        action,
        ...details
    });
};

/**
 * Log performance per metriche
 */
export const logPerformance = (operation: string, durationMs: number, details?: Record<string, any>) => {
    const level = durationMs > 5000 ? 'warn' : 'debug';
    logger.log(level, `⏱️ Performance: ${operation}`, {
        event: 'performance',
        operation,
        durationMs,
        slow: durationMs > 5000,
        ...details
    });
};

/**
 * Log API request (per middleware)
 */
export const logApiRequest = (method: string, path: string, statusCode: number, durationMs: number, details?: Record<string, any>) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `${method} ${path} ${statusCode}`, {
        event: 'api_request',
        method,
        path,
        statusCode,
        durationMs,
        ...details
    });
};
