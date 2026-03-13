
import { MasterFileService } from '../services/MasterFileService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Avvio consolidamento Master File con i nuovi filtri...');
    try {
        const user = await prisma.utente.findFirst();
        if (!user) throw new Error('User not found');
        const result = await MasterFileService.consolidaMasterFile(user.id);
        console.log('✅ Consolidamento completato:', result);
    } catch (error) {
        console.error('❌ Errore consolidamento:', error);
    }
}

main()
    .finally(async () => await prisma.$disconnect());
