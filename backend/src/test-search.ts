import { NormalizationService } from './services/NormalizationService';
import prisma from './config/database';

async function testSearch() {
    console.log('--- TEST RICERCA MARCHI ---');
    const brands = await NormalizationService.search('brand', 'hp');
    console.log('Risultati HP:', brands.map(b => b.nome));

    console.log('\n--- TEST RICERCA CATEGORIE ---');
    const categories = await NormalizationService.search('category', 'monitor');
    console.log('Risultati Monitor:', categories.map(c => c.nome));

    const categories2 = await NormalizationService.search('category', '003');
    console.log('Risultati 003:', categories2.map(c => c.nome));

    await prisma.$disconnect();
}

testSearch().catch(console.error);
