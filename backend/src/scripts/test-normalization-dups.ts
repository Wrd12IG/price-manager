import { NormalizationService } from '../services/NormalizationService';
import prisma from '../config/database';

async function checkDuplicates() {
    console.log('🔍 Controllo potenziali duplicati (algoritmo attuale)...');
    
    try {
        const brands = await NormalizationService.getPotentialDuplicates('brand');
        console.log(`\n🏷️ MARCHI (${brands.length} potenziali):`);
        brands.slice(0, 10).forEach(d => console.log(` - ${d.item1.nome} <-> ${d.item2.nome} (${d.reason})`));

        const cats = await NormalizationService.getPotentialDuplicates('category');
        console.log(`\n📂 CATEGORIE (${cats.length} potenziali):`);
        cats.slice(0, 20).forEach(d => console.log(` - ${d.item1.nome} <-> ${d.item2.nome} (${d.reason})`));

    } catch (e) {
        console.error(e);
    }

    await prisma.$disconnect();
}

checkDuplicates();
