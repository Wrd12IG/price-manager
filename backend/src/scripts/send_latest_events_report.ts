
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../services/EmailService';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function sendLatestEventsReport() {
    console.log("Starting report generation...");

    try {
        // 1. Get Logged Events (Last 24 hours or last 50 items)
        const logs = await prisma.logElaborazione.findMany({
            take: 50,
            orderBy: {
                dataEsecuzione: 'desc'
            }
        });

        if (logs.length === 0) {
            console.log("No logs found to report.");
            return;
        }

        // 2. Format HTML Report
        const tableRows = logs.map(log => {
            const date = new Date(log.dataEsecuzione).toLocaleString('it-IT');
            let statusColor = 'black';
            if (log.stato === 'success') statusColor = 'green';
            if (log.stato === 'warning') statusColor = 'orange';
            if (log.stato === 'error') statusColor = 'red';

            return `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${log.faseProcesso}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${log.stato}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${log.prodottiProcessati}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${log.prodottiErrore}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-size: 0.9em;">
                        ${log.dettagliJson ? (log.dettagliJson.length > 100 ? log.dettagliJson.substring(0, 100) + '...' : log.dettagliJson) : ''}
                    </td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <h2>Report Ultimi Eventi - Price Manager</h2>
            <p>Di seguito gli ultimi 50 log registrati dal sistema:</p>
            <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
                <thead>
                    <tr style="background-color: #f2f2f2; text-align: left;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Data</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Fase</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Stato</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Proc.</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Err.</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Dettagli</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <p style="margin-top: 20px; font-size: 0.8em; color: #666;">Report generato automaticamente il ${new Date().toLocaleString('it-IT')}</p>
        `;

        // 3. Get Recipient
        const emailConfig = await prisma.configurazioneSistema.findUnique({
            where: { chiave: 'notification_email' }
        });

        const recipient = emailConfig?.valore || 'roberto@wrdigital.it'; // Fallback if not configured in DB, but prefer DB

        console.log(`Sending report to: ${recipient}`);

        // 4. Send Email
        const sent = await EmailService.send(
            recipient,
            `Price Manager - Report Eventi ${new Date().toLocaleDateString('it-IT')}`,
            htmlContent,
            true
        );

        if (sent) {
            console.log("Report sent successfully.");
        } else {
            console.error("Failed to send report.");
        }

    } catch (error) {
        console.error("Error generating/sending report:", error);
    } finally {
        await prisma.$disconnect();
    }
}

sendLatestEventsReport();
