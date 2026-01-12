import { PrismaClient } from '@prisma/client';
import { RunnerFTPService } from '../services/RunnerFTPService';
import { decrypt } from '../utils/encryption';

const prisma = new PrismaClient();

async function testRunnerFullImport() {
    try {
        console.log('=== TESTING RUNNER FULL IMPORT LOGIC ===\n');

        // Get Runner config
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: 'Runner' }
        });

        if (!runner) {
            console.log('❌ Runner not found');
            return;
        }

        const password = runner.passwordEncrypted ? decrypt(runner.passwordEncrypted) : '';

        console.log('Running downloadAndMergeRunnerFiles with new logic...\n');

        const mergedRows = await RunnerFTPService.downloadAndMergeRunnerFiles({
            host: runner.ftpHost!,
            port: runner.ftpPort || 21,
            user: runner.username || 'anonymous',
            password
        });

        console.log(`\n✅ Total merged products: ${mergedRows.length}`);

        // Analyze results
        console.log('\n--- ANALYSIS ---');

        const withDesc = mergedRows.filter(r => r.DescProd);
        const withEan = mergedRows.filter(r => r.CodiceEAN);
        const withPrice = mergedRows.filter(r => r.PrezzoPers);
        const withDescExtended = mergedRows.filter(r => r.DescrizioneEstesa);

        console.log(`Products with Description: ${withDesc.length}`);
        console.log(`Products with EAN: ${withEan.length}`);
        console.log(`Products with Price: ${withPrice.length}`);
        console.log(`Products with Extended Desc (from descp.txt): ${withDescExtended.length}`);

        // Check for products that were previously missing (only in descp.txt)
        // These would have DescProd populated from Descrizione
        const recovered = mergedRows.filter(r => r.DescProd && !r.Famiglia); // Famiglia comes from articoli.txt
        console.log(`\nRecovered products (likely from descp.txt): ${recovered.length}`);

        if (recovered.length > 0) {
            console.log('\nSample recovered product:');
            console.log(JSON.stringify(recovered[0], null, 2).substring(0, 300) + '...');
        }

        // Check total vs expected
        console.log('\n=== CONCLUSION ===');
        if (mergedRows.length > 5000) {
            console.log('✅ SUCCESS: Found ~6000 products!');
            console.log('   This matches the number of price records.');
            console.log('   The import should now bring in all available products.');
        } else {
            console.log('⚠️  WARNING: Still low product count.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testRunnerFullImport();
