import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Crea istanza Prisma con logging
const prisma = new PrismaClient({
    log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' }
    ]
});

// Log query in development
if (process.env.NODE_ENV === 'development') {
    prisma.$on('query' as never, (e: any) => {
        logger.debug('Query:', {
            query: e.query,
            duration: `${e.duration}ms`
        });
    });
}

// Log errori
prisma.$on('error' as never, (e: any) => {
    logger.error('Prisma Error:', e);
});

// Log warning
prisma.$on('warn' as never, (e: any) => {
    logger.warn('Prisma Warning:', e);
});

// Gestione graceful shutdown
// Gestione graceful shutdown
// process.on('beforeExit', async () => {
//     await prisma.$disconnect();
//     logger.info('Database disconnected');
// });

export default prisma;
