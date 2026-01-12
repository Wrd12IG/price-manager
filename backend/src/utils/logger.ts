import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Crea directory logs se non esiste
const logDir = path.resolve(process.cwd(), process.env.LOG_DIR || './logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

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
            msg += ` ${JSON.stringify(meta)}`;
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

// Helper per log strutturati
export const logProcessStart = (processName: string, details?: any) => {
    logger.info(`🚀 Inizio processo: ${processName}`, details);
};

export const logProcessEnd = (processName: string, duration: number, details?: any) => {
    logger.info(`✅ Fine processo: ${processName} (${duration}s)`, details);
};

export const logProcessError = (processName: string, error: Error, details?: any) => {
    logger.error(`❌ Errore processo: ${processName}`, {
        error: error.message,
        stack: error.stack,
        ...details
    });
};
