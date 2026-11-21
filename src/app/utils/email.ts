/* eslint-disable @typescript-eslint/no-explicit-any */
import ejs from "ejs";
import status from "http-status";
import nodemailer from "nodemailer";
import path from "path";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";

const smtpPort = Number(envVars.EMAIL_SENDER.SMTP_PORT) || 465;

const transporter = nodemailer.createTransport({
    host: envVars.EMAIL_SENDER.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
        user: envVars.EMAIL_SENDER.SMTP_USER,
        pass: envVars.EMAIL_SENDER.SMTP_PASS,
    },
});

interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType: string;
}

interface SendEmailOptions {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    attachments?: EmailAttachment[];
}

const sendViaResend = async ({
    apiKey,
    from,
    to,
    subject,
    html,
    attachments,
}: {
    apiKey: string;
    from: string;
    to: string;
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
}) => {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [to],
            subject,
            html,
            text,
            ...(attachments?.length
                ? {
                      attachments: attachments.map((attachment) => ({
                          filename: attachment.filename,
                          content: Buffer.isBuffer(attachment.content)
                              ? attachment.content.toString("base64")
                              : Buffer.from(attachment.content).toString("base64"),
                      })),
                  }
                : {}),
        }),
        signal: AbortSignal.timeout(15000),
    });

    const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
    };

    if (!response.ok || !data?.id) {
        throw new Error(data?.message || `Resend API error (${response.status})`);
    }

    return data;
};

export const sendEmail = async ({ subject, templateData, templateName, to, attachments }: SendEmailOptions) => {
    try {
        const templatePath = path.resolve(process.cwd(), `src/app/templates/${templateName}.ejs`);
        const html = await ejs.renderFile(templatePath, templateData);

        if (envVars.RESEND.API_KEY) {
            const fromAddress = envVars.RESEND.FROM_EMAIL || envVars.EMAIL_SENDER.SMTP_FROM;
            await sendViaResend({
                apiKey: envVars.RESEND.API_KEY,
                from: fromAddress,
                to,
                subject,
                html,
                attachments,
            });
            return;
        }

        await transporter.sendMail({
            from: envVars.EMAIL_SENDER.SMTP_FROM,
            to,
            subject,
            html,
            attachments: attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType,
            })),
        });
    } catch (error: any) {
        throw new AppError(status.INTERNAL_SERVER_ERROR, `Email could not be sent: ${error.message}`);
    }
};
