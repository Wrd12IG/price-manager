import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Carichiamo le variabili d'ambiente PRIMA di inizializzare Prisma
dotenv.config();

// FIX CRITICO: Forza SSL per Supabase se manca
const fixUrl = (url: string | undefined) => {
    if (!url) return url;
    if (url.includes('sslmode=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sslmode=require`;
};

if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = fixUrl(process.env.DATABASE_URL);
}
if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = fixUrl(process.env.DIRECT_URL);
}

// Crea istanza Prisma ottimizzata per Supabase/PgBouncer
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    },
    log: ['error', 'warn']
});

// Test connessione silente
prisma.$connect()
    .then(() => logger.info('✅ Connessione Database stabilita'))
    .catch(err => logger.error('❌ Errore connessione Database:', err.message));

export default prisma;
