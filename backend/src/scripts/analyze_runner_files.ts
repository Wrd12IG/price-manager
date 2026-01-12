import { PrismaClient } from '@prisma/client';
import { FTPService } from '../services/FTPService';
import { FileParserService } from '../services/FileParserService';
import { FileMergeService } from '../services/FileMergeService';
import { decrypt } from '../utils/encryption';

const prisma = new PrismaClient();

async function analyzeRunnerFiles() {
    try {
        console.log('=== ANALYZING RUNNER FILES ===\n');

        // Get Runner config
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: 'Runner' }
        });

        if (!runner) {
            console.log('❌ Runner not found');
            return;
        }

        const password = runner.passwordEncrypted ? decrypt(runner.passwordEncrypted) : '';

        const filesToDownload = [
            { directory: '/', filename: 'articoli.txt' },
            { directory: '/', filename: 'arrivi.txt' },
            { directory: '/C200835', filename: 'prezzi.txt' }
        ];

        console.log('Downloading and analyzing files...\n');

        const files: Array<{ filename: string; buffer: Buffer }> = [];
        const parsedFiles: Array<{ filename: string; rows: any[] }> = [];

        // Download files
        for (const fileConfig of filesToDownload) {
            try {
                console.log(`Downloading ${fileConfig.filename} from ${fileConfig.directory}...`);
                const file = await FTPService.downloadSpecificFile({
                    host: runner.ftpHost!,
                    port: runner.ftpPort || 21,
                    user: runner.username || 'anonymous',
                    password,
                    directory: fileConfig.directory,
                    filename: fileConfig.filename
                });

                files.push(file);

                const sizeKB = Math.round(file.buffer.length / 1024);
                console.log(`✅ Downloaded: ${file.filename} (${sizeKB}KB)\n`);
            } catch (error: any) {
                console.log(`❌ Failed to download ${fileConfig.filename}: ${error.message}\n`);
            }
        }

        // Parse each file
        console.log('--- PARSING FILES ---\n');

        for (const file of files) {
            console.log(`Parsing ${file.filename}...`);

            const parseResult = await FileParserService.parseFile({
                format: 'CSV',
                buffer: file.buffer,
                encoding: 'UTF-8',
                csvSeparator: '|'
            });

            // Normalize key field for prezzi.txt
            if (file.filename === 'prezzi.txt') {
                parseResult.rows = parseResult.rows.map(row => {
                    if (row['codice']) {
                        row['Codice'] = row['codice'];
                        delete row['codice'];
                    }
                    return row;
                });
            }

            parsedFiles.push({
                filename: file.filename,
                rows: parseResult.rows
            });

            console.log(`  Rows: ${parseResult.rows.length}`);

            // Show sample row
            if (parseResult.rows.length > 0) {
                const sample = parseResult.rows[0];
                console.log(`  Columns: ${Object.keys(sample).join(', ')}`);
                console.log(`  Sample row:`, JSON.stringify(sample, null, 2).substring(0, 200) + '...');
            }
            console.log('');
        }

        // Summary before merge
        console.log('--- BEFORE MERGE ---');
        const totalRowsBeforeMerge = parsedFiles.reduce((sum, f) => sum + f.rows.length, 0);
        console.log(`Total rows across all files: ${totalRowsBeforeMerge}\n`);

        for (const pf of parsedFiles) {
            console.log(`  ${pf.filename}: ${pf.rows.length} rows`);
        }

        // Merge
        console.log('\n--- MERGING FILES ---\n');
        console.log('Merge key: "Codice"');

        const mergedRows = FileMergeService.mergeFilesByKeySimple(parsedFiles, 'Codice');

        console.log(`\n✅ Merged result: ${mergedRows.length} unique products`);
        console.log(`Lost in merge: ${totalRowsBeforeMerge - mergedRows.length} rows`);

        // Analyze merge
        console.log('\n--- MERGE ANALYSIS ---\n');

        // Check how many rows from each file made it to the merge
        for (const pf of parsedFiles) {
            const codesInFile = new Set(pf.rows.map(r => r.Codice || r.codice).filter(c => c));
            const codesInMerge = new Set(mergedRows.map(r => r.Codice).filter(c => c));

            const intersection = new Set([...codesInFile].filter(c => codesInMerge.has(c)));

            console.log(`${pf.filename}:`);
            console.log(`  Unique codes in file: ${codesInFile.size}`);
            console.log(`  Codes in merged result: ${intersection.size}`);
            console.log(`  Lost: ${codesInFile.size - intersection.size}`);
            console.log('');
        }

        // Check for rows without Codice
        console.log('--- DATA QUALITY CHECK ---\n');

        for (const pf of parsedFiles) {
            const withoutCode = pf.rows.filter(r => !r.Codice && !r.codice);
            console.log(`${pf.filename}:`);
            console.log(`  Rows without Codice: ${withoutCode.length} (${Math.round(withoutCode.length / pf.rows.length * 100)}%)`);

            if (withoutCode.length > 0 && withoutCode.length < 5) {
                console.log(`  Sample rows without Codice:`);
                withoutCode.slice(0, 3).forEach(r => {
                    console.log(`    ${JSON.stringify(r).substring(0, 100)}...`);
                });
            }
            console.log('');
        }

        // Sample merged products
        console.log('--- SAMPLE MERGED PRODUCTS ---\n');
        mergedRows.slice(0, 5).forEach((row, i) => {
            console.log(`${i + 1}. Codice: ${row.Codice}`);
            console.log(`   Fields: ${Object.keys(row).length}`);
            console.log(`   Sample: ${JSON.stringify(row).substring(0, 150)}...`);
            console.log('');
        });

        // Final summary
        console.log('=== SUMMARY ===\n');
        console.log(`Files downloaded: ${files.length}/3`);
        console.log(`Total rows before merge: ${totalRowsBeforeMerge}`);
        console.log(`Unique products after merge: ${mergedRows.length}`);
        console.log(`Expected products: ~12,000`);
        console.log(`Missing: ~${12000 - mergedRows.length}`);

        if (mergedRows.length < 12000) {
            console.log('\n⚠️  ISSUE: Not enough products!');
            console.log('\nPossible causes:');
            console.log('1. Files on FTP server contain less data than expected');
            console.log('2. Wrong files are being downloaded');
            console.log('3. File format has changed');
            console.log('4. Merge is losing data (check rows without Codice)');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeRunnerFiles();
