import { FTPService } from '../services/FTPService';
import { FileParserService } from '../services/FileParserService';
import prisma from '../config/database';
import { decrypt } from '../utils/encryption';

async function debugRunnerFiles() {
    console.log("🔍 Analisi file FTP Runner...\n");

    const fornitore = await prisma.fornitore.findFirst({ where: { nomeFornitore: 'Runner' } });
    if (!fornitore) {
        console.log('Fornitore Runner non trovato');
        await prisma.$disconnect();
        return;
    }

    const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
    console.log('FTP Config:', fornitore.ftpHost, fornitore.ftpPort, fornitore.username);

    const filesToDownload = [
        { directory: '/', filename: 'articoli.txt' },
        { directory: '/', filename: 'arrivi.txt' },
        { directory: '/', filename: 'descp.txt' },
        { directory: '/C200835', filename: 'prezzi.txt' }
    ];

    const allCodici: Set<string> = new Set();
    const fileStats: { [key: string]: { rows: number; codiciUnici: number } } = {};

    for (const fileConfig of filesToDownload) {
        try {
            console.log(`\nScaricando ${fileConfig.directory}${fileConfig.filename}...`);

            const file = await FTPService.downloadSpecificFile({
                host: fornitore.ftpHost!,
                port: fornitore.ftpPort || 21,
                user: fornitore.username || 'anonymous',
                password,
                directory: fileConfig.directory,
                filename: fileConfig.filename
            });

            console.log(`  Dimensione file: ${(file.buffer.length / 1024).toFixed(2)} KB`);

            const parseResult = await FileParserService.parseFile({
                format: 'CSV',
                buffer: file.buffer,
                encoding: 'UTF-8',
                csvSeparator: '|',
                quote: ''
            });

            const codiciInFile = new Set<string>();
            for (const row of parseResult.rows) {
                const codice = row['Codice']?.toString().trim() || row['codice']?.toString().trim();
                if (codice) {
                    codiciInFile.add(codice);
                    allCodici.add(codice);
                }
            }

            fileStats[fileConfig.filename] = {
                rows: parseResult.rows.length,
                codiciUnici: codiciInFile.size
            };

            console.log(`  ✅ ${fileConfig.filename}: ${parseResult.rows.length} righe, ${codiciInFile.size} codici unici`);
            if (parseResult.rows.length > 0) {
                console.log('  Colonne:', Object.keys(parseResult.rows[0]).slice(0, 10).join(', '), '...');
            }
        } catch (err: any) {
            console.log(`  ❌ ${fileConfig.filename}: ERRORE - ${err.message}`);
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log("RIEPILOGO:");
    console.log("=".repeat(50));

    for (const [filename, stats] of Object.entries(fileStats)) {
        console.log(`${filename}: ${stats.rows} righe, ${stats.codiciUnici} codici`);
    }

    console.log(`\n📊 TOTALE CODICI UNICI (unione di tutti i file): ${allCodici.size}`);

    await prisma.$disconnect();
}

debugRunnerFiles().catch(console.error);
