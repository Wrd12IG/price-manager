import { PrismaClient } from '@prisma/client';
import { FTPService } from '../services/FTPService';
import { FileParserService } from '../services/FileParserService';
import { decrypt } from '../utils/encryption';

const prisma = new PrismaClient();

async function analyzeDescpFile() {
    try {
        console.log('=== ANALYZING DESCP.TXT ===\n');

        // Get Runner config
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: 'Runner' }
        });

        if (!runner) {
            console.log('❌ Runner not found');
            return;
        }

        const password = runner.passwordEncrypted ? decrypt(runner.passwordEncrypted) : '';

        console.log('Downloading descp.txt...\n');

        const file = await FTPService.downloadSpecificFile({
            host: runner.ftpHost!,
            port: runner.ftpPort || 21,
            user: runner.username || 'anonymous',
            password,
            directory: '/',
            filename: 'descp.txt'
        });

        const sizeKB = Math.round(file.buffer.length / 1024);
        console.log(`✅ Downloaded: descp.txt (${sizeKB}KB)\n`);

        // Parse file
        console.log('Parsing file...');

        const parseResult = await FileParserService.parseFile({
            format: 'CSV',
            buffer: file.buffer,
            encoding: 'UTF-8',
            csvSeparator: '|'
        });

        console.log(`Rows: ${parseResult.rows.length}`);

        if (parseResult.rows.length > 0) {
            const sample = parseResult.rows[0];
            console.log(`Columns: ${Object.keys(sample).join(', ')}`);
            console.log(`Sample row:`, JSON.stringify(sample, null, 2).substring(0, 200) + '...');
        }

        // Check overlap with articoli.txt
        // We need to know if descp.txt has MORE products than articoli.txt
        // or if it just adds descriptions to existing ones.

        // Let's count unique codes
        const codes = new Set(parseResult.rows.map(r => r.Codice || r.codice).filter(c => c));
        console.log(`\nUnique codes in descp.txt: ${codes.size}`);

        // Compare with previous finding (articoli.txt had 2696 rows)
        console.log(`Compared to articoli.txt (~2700 rows):`);
        if (codes.size > 3000) {
            console.log(`✅ descp.txt contains significantly more products!`);
            console.log(`   This is likely the missing source of products.`);
        } else {
            console.log(`⚠️  descp.txt has similar count to articoli.txt.`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeDescpFile();
