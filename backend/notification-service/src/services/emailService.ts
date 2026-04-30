import nodemailer from 'nodemailer';

type SendEmailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function buildTransporter(): Promise<nodemailer.Transporter> {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
        return nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });
    }

    const account = await nodemailer.createTestAccount();
    console.log('[notification-service] usando cuenta de prueba Ethereal para SMTP');

    return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass,
        },
    });
}

async function getTransporter(): Promise<nodemailer.Transporter> {
    if (!transporterPromise) {
        transporterPromise = buildTransporter();
    }
    return transporterPromise;
}

export async function sendEmail(input: SendEmailInput): Promise<{ success: true; messageId: string } | { success: false; error: unknown }> {
    try {
        const transporter = await getTransporter();
        const info = await transporter.sendMail({
            from: '"FitBeat Notificaciones" <noreply@fitbeat.example.com>',
            to: input.to,
            subject: input.subject,
            text: input.text,
            html: input.html,
        });

        console.log('[notification-service] correo enviado', {
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info) || null,
        });

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[notification-service] error enviando correo', error);
        return { success: false, error };
    }
}
