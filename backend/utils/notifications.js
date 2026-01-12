const nodemailer = require('nodemailer');
const axios = require('axios');

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} Send result
 */
async function sendEmail({ to, subject, text, html }) {
    try {
        const transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.NOTIFICATION_EMAIL_FROM || process.env.SMTP_USER,
            to: to || process.env.NOTIFICATION_EMAIL_TO,
            subject,
            text,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send Slack notification
 * @param {string} message - Message to send
 * @param {string} webhookUrl - Slack webhook URL (optional, uses env var if not provided)
 * @returns {Promise<Object>} Send result
 */
async function sendSlackNotification(message, webhookUrl = null) {
    try {
        const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;

        if (!url) {
            console.warn('Slack webhook URL not configured');
            return { success: false, error: 'Webhook URL not configured' };
        }

        const response = await axios.post(url, {
            text: message,
            username: 'Price Manager Bot',
            icon_emoji: ':chart_with_upwards_trend:'
        });

        console.log('Slack notification sent');
        return { success: true, response: response.data };
    } catch (error) {
        console.error('Slack notification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send Telegram notification
 * @param {string} message - Message to send
 * @param {string} botToken - Telegram bot token (optional, uses env var if not provided)
 * @param {string} chatId - Telegram chat ID (optional, uses env var if not provided)
 * @returns {Promise<Object>} Send result
 */
async function sendTelegramNotification(message, botToken = null, chatId = null) {
    try {
        const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
        const chat = chatId || process.env.TELEGRAM_CHAT_ID;

        if (!token || !chat) {
            console.warn('Telegram credentials not configured');
            return { success: false, error: 'Credentials not configured' };
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const response = await axios.post(url, {
            chat_id: chat,
            text: message,
            parse_mode: 'HTML'
        });

        console.log('Telegram notification sent');
        return { success: true, response: response.data };
    } catch (error) {
        console.error('Telegram notification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send notification to all configured channels
 * @param {Object} notification - Notification details
 * @param {string} notification.subject - Subject/title
 * @param {string} notification.message - Message content
 * @param {string} notification.type - Notification type (success, error, warning, info)
 * @returns {Promise<Object>} Results from all channels
 */
async function sendNotificationToAll({ subject, message, type = 'info' }) {
    const results = {
        email: null,
        slack: null,
        telegram: null
    };

    // Determine emoji based on type
    const emoji = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    }[type] || 'ℹ️';

    // Email notification
    if (process.env.NOTIFICATION_EMAIL_TO) {
        const html = `
      <h2>${emoji} ${subject}</h2>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        E-commerce Price Management System<br>
        ${new Date().toLocaleString('it-IT')}
      </p>
    `;

        results.email = await sendEmail({
            subject: `${emoji} ${subject}`,
            text: message,
            html
        });
    }

    // Slack notification
    if (process.env.SLACK_WEBHOOK_URL) {
        const slackMessage = `${emoji} *${subject}*\n${message}`;
        results.slack = await sendSlackNotification(slackMessage);
    }

    // Telegram notification
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const telegramMessage = `${emoji} <b>${subject}</b>\n${message}`;
        results.telegram = await sendTelegramNotification(telegramMessage);
    }

    return results;
}

/**
 * Send process completion notification
 * @param {Object} processResult - Process execution result
 * @returns {Promise<Object>} Notification results
 */
async function notifyProcessCompletion(processResult) {
    const {
        success,
        duration,
        productsProcessed,
        errors,
        warnings,
        timestamp
    } = processResult;

    const type = success ? 'success' : 'error';
    const subject = success
        ? 'Elaborazione Listini Completata'
        : 'Elaborazione Listini Fallita';

    let message = `
Esecuzione: ${new Date(timestamp).toLocaleString('it-IT')}
Durata: ${Math.round(duration / 1000)}s
Prodotti elaborati: ${productsProcessed || 0}
`;

    if (errors && errors.length > 0) {
        message += `\nErrori: ${errors.length}\n`;
        errors.slice(0, 5).forEach(err => {
            message += `  - ${err}\n`;
        });
        if (errors.length > 5) {
            message += `  ... e altri ${errors.length - 5} errori\n`;
        }
    }

    if (warnings && warnings.length > 0) {
        message += `\nAvvisi: ${warnings.length}\n`;
    }

    return await sendNotificationToAll({ subject, message, type });
}

module.exports = {
    sendEmail,
    sendSlackNotification,
    sendTelegramNotification,
    sendNotificationToAll,
    notifyProcessCompletion
};
