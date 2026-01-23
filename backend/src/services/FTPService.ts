import * as ftp from 'basic-ftp';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export class FTPService {
    /**
     * Tenta la connessione FTP provando sia modalità sicura che normale
     */
    private static async smartAccess(client: ftp.Client, config: any) {
        const accessConfig = {
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            secure: config.secure || false
        };

        try {
            // Tenta come configurato
            await client.access(accessConfig);
        } catch (err: any) {
            logger.warn(`Primo tentativo FTP fallito (${accessConfig.secure ? 'Sicuro' : 'Normale'}): ${err.message}. Riprovo nell'altra modalità...`);

            // Se fallisce, prova il contrario
            accessConfig.secure = !accessConfig.secure;
            try {
                await client.access(accessConfig);
                logger.info(`Connessione FTP riuscita in modalità ${accessConfig.secure ? 'Sicura' : 'Normale'}`);
            } catch (err2: any) {
                throw new Error(`Impossibile connettersi al server FTP in nessuna modalità: ${err2.message}`);
            }
        }
    }

    /**
     * Scarica tutti i file da una directory FTP (Legacy)
     */
    static async downloadAndMergeFiles(config: any): Promise<Array<{ filename: string; buffer: Buffer }>> {
        const client = new ftp.Client();
        client.ftp.verbose = false;
        try {
            await this.smartAccess(client, config);
            if (config.directory) await client.cd(config.directory);

            const fileList = await client.list();
            const files: Array<{ filename: string; buffer: Buffer }> = [];

            for (const file of fileList) {
                if (file.isFile) {
                    const { Writable } = await import('stream');
                    const chunks: Buffer[] = [];
                    const writeStream = new Writable({
                        write(chunk, encoding, callback) {
                            chunks.push(chunk);
                            callback();
                        }
                    });
                    await client.downloadTo(writeStream, file.name);
                    files.push({ filename: file.name, buffer: Buffer.concat(chunks) });
                }
            }
            return files;
        } catch (error: any) {
            throw new AppError(`Errore FTP: ${error.message}`, 500);
        } finally {
            client.close();
        }
    }

    /**
     * Scarica un file come stream
     */
    static async downloadToStream(config: any, stream: any): Promise<void> {
        const client = new ftp.Client();
        client.ftp.verbose = false;
        try {
            await this.smartAccess(client, config);
            if (config.directory) await client.cd(config.directory);
            await client.downloadTo(stream, config.filename);
        } catch (error: any) {
            logger.error(`Errore streaming FTP ${config.filename}:`, error.message);
            throw new Error(error.message);
        } finally {
            client.close();
        }
    }

    /**
     * Scarica un file specifico (Legacy wrapper)
     */
    static async downloadSpecificFile(config: any): Promise<{ filename: string; buffer: Buffer }> {
        const { Writable } = await import('stream');
        const chunks: Buffer[] = [];
        const writeStream = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });
        await this.downloadToStream(config, writeStream);
        return { filename: config.filename, buffer: Buffer.concat(chunks) };
    }

    /**
     * Testa la connessione
     */
    static async testConnection(config: any): Promise<{ success: boolean; fileCount?: number; error?: string }> {
        const client = new ftp.Client();
        try {
            await this.smartAccess(client, config);
            if (config.directory) await client.cd(config.directory);
            const fileList = await client.list();
            const fileCount = fileList.filter(f => f.isFile).length;
            return { success: true, fileCount };
        } catch (error: any) {
            return { success: false, error: error.message };
        } finally {
            client.close();
        }
    }

    /**
     * Lista file
     */
    static async listFiles(config: any): Promise<any[]> {
        const client = new ftp.Client();
        try {
            await this.smartAccess(client, config);
            if (config.directory) await client.cd(config.directory);
            return await client.list();
        } catch (error: any) {
            logger.error(`Errore listing FTP ${config.directory}:`, error.message);
            throw new Error(error.message);
        } finally {
            client.close();
        }
    }
}
