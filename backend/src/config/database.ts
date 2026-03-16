import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Carichiamo le variabili d'ambiente PRIMA di inizializzare Prisma
dotenv.config();

// Ottimizzazione pool connessioni
const getOptimizedUrl = (url: string | undefined) => {
    if (!url) return url;

    // Rimuovi eventuali parametri esistenti
    let cleanUrl = url.split('?')[0];

    // connection_limit: 20 (adatto per il traffico previsto)
    // pool_timeout: 30 (secondi di attesa per una connessione)
    return `${cleanUrl}?connection_limit=20&pool_timeout=30`;
};

const optimizedUrl = getOptimizedUrl(process.env.DATABASE_URL);

if (optimizedUrl) {
    process.env.DATABASE_URL = optimizedUrl;
}

// Crea istanza Prisma singleton
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: optimizedUrl
        }
    },
    log: ['error', 'warn']
});

// Test connessione silente
prisma.$connect()
    .then(() => logger.info('✅ Connessione Database stabilita con pool ottimizzato (20)'))
    .catch(err => logger.error('❌ Errore connessione Database:', err.message));

export default prisma;

