// @ts-nocheck
import * as ftp from 'basic-ftp';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export class FTPService {
    /**
     * Tenta la connessione FTP provando diverse modalità di sicurezza
     */
    private static async smartAccess(client: ftp.Client, config: any) {
        const modes = [
            { secure: false, label: 'Normale (Porta 21)' },
            { secure: true, label: 'Sicuro (Esplicito TLS)' },
            { secure: 'implicit', label: 'Sicuro (Implicito TLS)' }
        ];

        let lastError = null;

        for (const mode of modes) {
            try {
                logger.info(`FTP Attempt: Provando modalità ${mode.label} su ${config.host}:${config.port}...`);

                if (!client.closed) {
                    client.close();
                }

                // Impostiamo il timeout per evitare fallimenti prematuri
                (client.ftp as any).timeout = 60000;

                await client.access({
                    host: config.host,
                    port: config.port,
                    user: config.user,
                    password: config.password,
                    secure: mode.secure as any
                });

                logger.info(`✅ FTP Connection Success: Modalità ${mode.label}`);
                return;
            } catch (err: any) {
                lastError = err;
                logger.warn(`❌ FTP Attempt Fallito (${mode.label}): ${err.message}`);

                // Se l'errore indica che il server non parla SSL (wrong version number), 
                // è inutile provare altre modalità sicure
                if (err.message.includes('wrong version number') || err.message.includes('SSL routines')) {
                    if (mode.secure === false) {
                        // Se fallisce il plain con errore SSL, c'è qualcosa di molto strano, ma continuiamo
                    } else {
                        logger.warn(`   Server non sembra supportare TLS, salto ulteriori tentativi sicuri.`);
                        break;
                    }
                }
            }
        }

        throw new Error(`Impossibile connettersi al server FTP ${config.host}:${config.port}. ${lastError?.message}`);
    }

    /**
     * Scarica tutti i file da una directory FTP (Legacy)
     */
    static async downloadAndMergeFiles(config: any): Promise<Array<{ filename: string; buffer: Buffer }>> {
        const client = new ftp.Client();
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
            throw new AppError(error.message, 502);
        } finally {
            client.close();
        }
    }

    /**
     * Scarica un file come stream
     */
    static async downloadToStream(config: any, stream: any): Promise<void> {
        const client = new ftp.Client();
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
    static async testConnection(config: any): Promise<{ success: boolean; fileCount?: number; error?: string; details?: any }> {
        const client = new ftp.Client();
        try {
            await this.smartAccess(client, config);
            if (config.directory) await client.cd(config.directory);
            const fileList = await client.list();
            const files = fileList.filter(f => f.isFile);
            return {
                success: true,
                fileCount: files.length,
                details: { filenames: files.slice(0, 10).map(f => f.name) }
            };
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
            if (config.directory) {
                try {
                    await client.cd(config.directory);
                } catch (cdErr: any) {
                    logger.warn(`Impossibile entrare nella directory ${config.directory}, provo a listare la root: ${cdErr.message}`);
                }
            }
            return await client.list();
        } catch (error: any) {
            logger.error(`Errore listing FTP ${config.directory}:`, error.message);
            throw new Error(error.message);
        } finally {
            client.close();
        }
    }
}
