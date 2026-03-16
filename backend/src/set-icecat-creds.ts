import { IcecatService } from './services/IcecatService';
import prisma from './config/database';

async function setCredentials() {
    try {
        console.log('🔐 Impostazione credenziali Icecat per utenti 1 e 3...');
        
        await IcecatService.saveConfig(1, 'Wrdigital', 'WrDigital2026!');
        await IcecatService.saveConfig(3, 'Wrdigital', 'WrDigital2026!');
        
        console.log('✅ Credenziali salvate e criptate nel database.');
    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setCredentials();
