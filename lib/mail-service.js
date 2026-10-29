import nodemailer from 'nodemailer';

export function createMailService() {
    let transporter;

    function getTransporter() {
        if (transporter) return transporter;

        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const password = process.env.SMTP_PASSWORD;
        const from = process.env.SMTP_FROM || user;

        if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
            const error = new Error('Password recovery email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.');
            error.code = 'PORTAL_EMAIL_NOT_CONFIGURED';
            throw error;
        }

        transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            requireTLS: port !== 465,
            auth: { user, pass: password },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });
        return transporter;
    }

    function getBaseUrl() {
        const configuredUrl = process.env.APP_BASE_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 5000}`);
        const baseUrl = new URL(configuredUrl);
        if (baseUrl.protocol !== 'https:' && baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '127.0.0.1') {
            const error = new Error('APP_BASE_URL must use HTTPS outside local development.');
            error.code = 'PORTAL_EMAIL_NOT_CONFIGURED';
            throw error;
        }
        return baseUrl;
    }

    function prepare() {
        getBaseUrl();
        getTransporter();
        return true;
    }

    async function sendPasswordReset(email, token) {
        const baseUrl = getBaseUrl();
        const resetUrl = new URL('/account/reset-password', baseUrl);
        resetUrl.searchParams.set('token', token);
        await getTransporter().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Reset your UoVT Student Hub password',
            text: `We received a request to reset the password for your student hub account.\n\nUse this one-time link within 30 minutes:\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
            html: `<p>We received a request to reset the password for your student hub account.</p><p><a href="${escapeHtml(resetUrl.toString())}">Reset your password</a></p><p>This one-time link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`
        });
    }

    return { prepare, sendPasswordReset };
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}
