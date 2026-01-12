import { PrismaClient } from '@prisma/client';
import { FTPService } from '../services/FTPService';
import { decrypt } from '../utils/encryption';

const prisma = new PrismaClient();

async function listRunnerFTP() {
    try {
        console.log('=== LISTING RUNNER FTP SERVER ===\n');

        // Get Runner config
        const runner = await prisma.fornitore.findFirst({
            where: { nomeFornitore: 'Runner' }
        });

        if (!runner) {
            console.log('❌ Runner not found');
            return;
        }

        const password = runner.passwordEncrypted ? decrypt(runner.passwordEncrypted) : '';

        console.log(`Connecting to: ${runner.ftpHost}:${runner.ftpPort || 21}`);
        console.log(`User: ${runner.username}`);
        console.log(`Directory: ${runner.ftpDirectory}\n`);

        // List files in root
        console.log('--- Files in ROOT (/) ---');
        try {
            const rootFiles = await FTPService.listFiles({
                host: runner.ftpHost!,
                port: runner.ftpPort || 21,
                user: runner.username || 'anonymous',
                password,
                directory: '/'
            });

            console.log(`Found ${rootFiles.length} files/directories:\n`);
            for (const file of rootFiles) {
                const type = file.type === 1 ? 'FILE' : 'DIR ';
                const size = file.size ? `${Math.round(file.size / 1024)}KB` : '';
                console.log(`  [${type}] ${file.name.padEnd(30)} ${size}`);
            }
        } catch (error: any) {
            console.log(`Error listing root: ${error.message}`);
        }

        // List files in C200835
        console.log('\n--- Files in /C200835 ---');
        try {
            const c200835Files = await FTPService.listFiles({
                host: runner.ftpHost!,
                port: runner.ftpPort || 21,
                user: runner.username || 'anonymous',
                password,
                directory: '/C200835'
            });

            console.log(`Found ${c200835Files.length} files/directories:\n`);
            for (const file of c200835Files) {
                const type = file.type === 1 ? 'FILE' : 'DIR ';
                const size = file.size ? `${Math.round(file.size / 1024)}KB` : '';
                console.log(`  [${type}] ${file.name.padEnd(30)} ${size}`);
            }
        } catch (error: any) {
            console.log(`Error listing C200835: ${error.message}`);
        }

        // Check for other directories
        console.log('\n--- Checking for other directories ---');
        const possibleDirs = ['/', '/C200835', '/listini', '/export', '/data', '/files'];

        for (const dir of possibleDirs) {
            try {
                const files = await FTPService.listFiles({
                    host: runner.ftpHost!,
                    port: runner.ftpPort || 21,
                    user: runner.username || 'anonymous',
                    password,
                    directory: dir
                });

                const txtFiles = files.filter(f => f.name.endsWith('.txt') || f.name.endsWith('.csv'));
                if (txtFiles.length > 0) {
                    console.log(`\n  ${dir}: ${txtFiles.length} text files`);
                    txtFiles.forEach(f => {
                        const size = f.size ? `${Math.round(f.size / 1024)}KB` : '';
                        console.log(`    - ${f.name} (${size})`);
                    });
                }
            } catch (error) {
                // Directory doesn't exist, skip
            }
        }

        console.log('\n=== CURRENT CONFIGURATION ===\n');
        console.log('RunnerFTPService downloads only:');
        console.log('  1. /articoli.txt');
        console.log('  2. /arrivi.txt');
        console.log('  3. /C200835/prezzi.txt');

        console.log('\n⚠️  If there are more files on the FTP server,');
        console.log('    they are NOT being imported!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listRunnerFTP();
