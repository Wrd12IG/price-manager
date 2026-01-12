
import { ProductFilterService } from '../services/ProductFilterService';

const service = new ProductFilterService();

async function checkCounts() {
    console.log('Calculating counts...');
    const counts = await service.getRuleMatchCounts();
    console.log('Counts:', JSON.stringify(counts, null, 2));
}

checkCounts().catch(console.error);
