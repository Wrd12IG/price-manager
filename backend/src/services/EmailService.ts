import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export class EmailService {
    private static getTransporter() {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Invia una email
     * @param to Destinatario
     * @param subject Oggetto
     * @param content Contenuto (HTML o testo semplice)
     * @param isHtml Se true, tratta content come HTML, altrimenti come testo
     */
    static async send(to: string, subject: string, content: string, isHtml: boolean = false): Promise<boolean> {
        // Verifica configurazione minima
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            logger.warn('⚠️ Credenziali SMTP non trovate. Invio email simulato.');
            logger.info(`📧 [Simulazione] To: ${to} | Subject: ${subject}`);
            return false;
        }

        try {
            const transporter = this.getTransporter();

            const mailOptions: nodemailer.SendMailOptions = {
                from: process.env.SMTP_FROM || '"Price Manager" <price_manager@wrdigital.it>',
                to,
                subject,
            };

            if (isHtml) {
                mailOptions.html = content;
            } else {
                mailOptions.text = content;
            }

            const info = await transporter.sendMail(mailOptions);
            logger.info(`✅ Email inviata correttamente: ${info.messageId}`);
            return true;
        } catch (error: any) {
            logger.error('❌ Errore durante l\'invio dell\'email:', error);
            return false;
        }
    }
}
