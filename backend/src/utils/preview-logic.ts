// @ts-nocheck
import axios from 'axios';
import { FTPService } from '../services/FTPService';
import { FileParserService } from '../services/FileParserService';
import { decrypt } from './encryption';
import { PassThrough } from 'stream';
import { logger } from './logger';

/**
 * Logica interna per l'anteprima dei file dei fornitori (HTTP o FTP)
 */
export async function previewListinoInternal(fornitore: any, rows: number = 5) {
    let stream: any;
    const isFTP = fornitore.tipoAccesso === 'ftp';

    try {
        // --- CASO SPECIALE RUNNER ---
        if (fornitore.nomeFornitore.toLowerCase() === 'runner') {
            const { RunnerFTPService } = await import('../services/RunnerFTPService');
            const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
            const mergedRows = await RunnerFTPService.downloadAndMergeRunnerFiles({
                host: fornitore.ftpHost.trim(),
                port: fornitore.port || 21,
                user: fornitore.username || 'anonymous',
                password
            });
            const headers = mergedRows.length > 0 ? Object.keys(mergedRows[0]) : [];
            return {
                headers,
                rows: mergedRows.slice(0, rows),
                totalRows: mergedRows.length,
                success: true
            };
        }

        if (isFTP) {
            if (!fornitore.ftpHost) throw new Error('Configurazione FTP incompleta (manca Host)');

            const password = fornitore.passwordEncrypted ? decrypt(fornitore.passwordEncrypted) : '';
            const baseDir = fornitore.ftpDirectory || '/';

            logger.info(`[PREVIEW] Tentativo FTP su ${fornitore.ftpHost}`);

            const files = await FTPService.listFiles({
                host: fornitore.ftpHost.trim(),
                port: fornitore.port || 21,
                user: fornitore.username || 'anonymous',
                password,
                directory: baseDir
            });

            // Trova il primo file importabile
            const firstFile = files.find(f => f.isFile && (
                f.name.endsWith('.csv') ||
                f.name.endsWith('.txt') ||
                f.name.endsWith('.xml') ||
                f.name.endsWith('.xlsx') ||
                /^[A-Z]\d{6}/.test(f.name) // Pattern tipico per alcuni fornitori
            ));

            if (!firstFile) throw new Error('Nessun file valido (.csv, .txt, .xml) trovato nella directory FTP');

            logger.info(`[PREVIEW] Download file per anteprima: ${firstFile.name}`);

            stream = new PassThrough();
            // Non attendiamo il download completo perché il parser deve iniziare a consumare lo stream
            FTPService.downloadToStream({
                host: fornitore.ftpHost.trim(),
                port: fornitore.port || 21,
                user: fornitore.username || 'anonymous',
                password,
                directory: baseDir,
                filename: firstFile.name
            }, stream).catch(err => {
                logger.error(`[PREVIEW] Errore background FTP: ${err.message}`);
                stream.destroy(err);
            });

        } else {
            // Logica HTTP
            if (!fornitore.urlListino) throw new Error('URL listino mancante');

            const axiosConfig: any = {
                responseType: 'stream',
                timeout: 60000, // Timeout esteso a 60s
                validateStatus: (status: number) => status < 500,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            };

            if (fornitore.tipoAccesso === 'http_auth' && fornitore.username && fornitore.passwordEncrypted) {
                const password = decrypt(fornitore.passwordEncrypted);
                axiosConfig.auth = { username: fornitore.username, password };
            }

            const response = await axios.get(fornitore.urlListino, axiosConfig);
            if (response.status !== 200) {
                throw new Error(`Il server ha risposto con codice ${response.status}`);
            }
            stream = response.data;
        }

        // FIX BREVI ANCHE PER PREVIEW
        const isBrevi = fornitore.nomeFornitore?.toLowerCase().includes('brevi') || fornitore.urlListino?.includes('brevi');
        const quoteChar = isBrevi ? '\0' : undefined;

        // Parsing dell'anteprima
        const result = await FileParserService.parseFile({
            format: fornitore.formatoFile,
            stream,
            previewRows: rows,
            csvSeparator: fornitore.separatoreCSV,
            encoding: isBrevi ? 'latin1' : fornitore.encoding,
            quote: quoteChar
        });

        return result;

    } catch (error: any) {
        logger.error(`[PREVIEW ERROR] ${fornitore.nomeFornitore}: ${error.message}`);
        throw error;
    }
}
