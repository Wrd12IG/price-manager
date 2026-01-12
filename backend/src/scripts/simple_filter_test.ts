import prisma from '../config/database';
import { ProductFilterService } from '../services/ProductFilterService';

async function testFilters() {
    try {
        console.log('Test recupero opzioni filtri...');
        const service = new ProductFilterService();
        const options = await service.getAvailableOptions();

        console.log(`✅ Marche trovate: ${options.brands.length}`);
        console.log(`✅ Categorie trovate: ${options.categories.length}`);

        if (options.brands.length > 0) {
            console.log('Esempio marche:', options.brands.slice(0, 5).join(', '));
        }
        if (options.categories.length > 0) {
            console.log('Esempio categorie:', options.categories.slice(0, 5).join(', '));
        }
    } catch (error) {
        console.error('Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testFilters();
