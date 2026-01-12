
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../services/EmailService';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkEmailConfig() {
    console.log("--- Checking Email Configuration ---");

    // 1. Check DB Config
    const emailConfig = await prisma.configurazioneSistema.findUnique({
        where: { chiave: 'notification_email' }
    });
    console.log("DB 'notification_email':", emailConfig ? emailConfig.valore : "NOT SET");

    // 2. Check Env Vars (masking passwords)
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("SMTP_PASS:", process.env.SMTP_PASS ? "****" : "NOT SET");
    console.log("SMTP_FROM:", process.env.SMTP_FROM);

    // 3. Try Sending Test Email if config exists
    if (emailConfig?.valore) {
        console.log(`\nAttempting to send test email to ${emailConfig.valore}...`);
        const result = await EmailService.send(
            emailConfig.valore,
            "Test Email from Price Manager",
            "<h1>It Works!</h1><p>This is a test email to verify your configuration.</p>",
            true
        );
        console.log("Send Result:", result ? "SUCCESS" : "FAILURE");
    } else {
        console.log("\nSkipping test email because 'notification_email' is not set in DB.");
    }
}

checkEmailConfig()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
