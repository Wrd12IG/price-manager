import * as ftp from 'basic-ftp';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export class FTPService {
    /**
     * Scarica tutti i file da una directory FTP e li unisce
     */
    static async downloadAndMergeFiles(config: {
        host: string;
        port: number;
        user: string;
        password: string;
        directory: string;
    }): Promise<Array<{ filename: string; buffer: Buffer }>> {
        const client = new ftp.Client();
        client.ftp.verbose = process.env.NODE_ENV === 'development';

        try {
            // Connessione al server FTP
            await client.access({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                secure: false // Cambia a true per FTPS
            });

            logger.info(`Connesso a FTP: ${config.host}:${config.port}`);

            // Cambia directory
            if (config.directory) {
                await client.cd(config.directory);
                logger.info(`Directory FTP: ${config.directory}`);
            }

            // Lista tutti i file nella directory
            const fileList = await client.list();
            logger.info(`Trovati ${fileList.length} file nella directory FTP`);

            const files: Array<{ filename: string; buffer: Buffer }> = [];

            // Scarica ogni file
            for (const file of fileList) {
                if (file.isFile) {
                    logger.info(`Scaricamento file: ${file.name}`);

                    const { Writable } = await import('stream');
                    const chunks: Buffer[] = [];

                    const writeStream = new Writable({
                        write(chunk: Buffer, encoding, callback) {
                            chunks.push(chunk);
                            callback();
                        }
                    });

                    await client.downloadTo(writeStream, file.name);

                    const buffer = Buffer.concat(chunks);
                    files.push({
                        filename: file.name,
                        buffer
                    });

                    logger.info(`File scaricato: ${file.name} (${buffer.length} bytes)`);
                }
            }

            return files;

        } catch (error: any) {
            logger.error('Errore FTP:', error);
            throw new AppError(`Errore FTP: ${error.message}`, 500);
        } finally {
            client.close();
        }
    }

    /**
     * Scarica un file come stream (più efficiente per file grandi)
     */
    static async downloadToStream(config: {
        host: string;
        port: number;
        user: string;
        password: string;
        directory: string;
        filename: string;
        secure?: boolean;
    }, stream: any): Promise<void> {
        const client = new ftp.Client();
        client.ftp.verbose = process.env.NODE_ENV === 'development';

        try {
            await client.access({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                secure: config.secure || false
            });

            if (config.directory) {
                await client.cd(config.directory);
            }

            await client.downloadTo(stream, config.filename);

        } catch (error: any) {
            logger.error(`Errore streaming FTP ${config.filename}:`, error);
            throw new AppError(`Errore FTP: ${error.message}`, 500);
        } finally {
            client.close();
        }
    }

    /**
     * Scarica un file specifico da una directory FTP (Legacy, usa internamente streaming)
     */
    static async downloadSpecificFile(config: {
        host: string;
        port: number;
        user: string;
        password: string;
        directory: string;
        filename: string;
    }): Promise<{ filename: string; buffer: Buffer }> {
        const { Writable } = await import('stream');
        const chunks: Buffer[] = [];

        const writeStream = new Writable({
            write(chunk: Buffer, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        await this.downloadToStream(config, writeStream);
        const buffer = Buffer.concat(chunks);

        return {
            filename: config.filename,
            buffer
        };
    }

    /**
     * Testa la connessione FTP
     */
    static async testConnection(config: {
        host: string;
        port: number;
        user: string;
        password: string;
        directory?: string;
        secure?: boolean;
    }): Promise<{ success: boolean; fileCount?: number; error?: string }> {
        const client = new ftp.Client();

        try {
            await client.access({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                secure: config.secure || false
            });

            if (config.directory) {
                await client.cd(config.directory);
            }

            const fileList = await client.list();
            const fileCount = fileList.filter(f => f.isFile).length;

            return {
                success: true,
                fileCount
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        } finally {
            client.close();
        }
    }

    /**
     * Lista i file in una directory FTP
     */
    static async listFiles(config: {
        host: string;
        port: number;
        user: string;
        password: string;
        directory: string;
    }): Promise<any[]> {
        const client = new ftp.Client();

        try {
            await client.access({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                secure: false
            });

            await client.cd(config.directory);
            const fileList = await client.list();

            return fileList;
        } catch (error: any) {
            logger.error(`Errore listing directory ${config.directory}:`, error);
            throw new AppError(`Errore FTP: ${error.message}`, 500);
        } finally {
            client.close();
        }
    }
}
