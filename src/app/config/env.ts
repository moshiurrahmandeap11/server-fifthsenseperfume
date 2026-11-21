import dotenv from 'dotenv';
import status from 'http-status';
import AppError from '../errorHelpers/AppError';

dotenv.config();

interface EnvConfig {
    NODE_ENV: string;
    PORT: string;
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: string;
    BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: string;
    EMAIL_SENDER: {
        SMTP_USER: string;
        SMTP_PASS: string;
        SMTP_HOST: string;
        SMTP_PORT: string;
        SMTP_FROM: string;
    };
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CALLBACK_URL: string;
    FRONTEND_URL: string;
    CLOUDINARY: {
        CLOUDINARY_CLOUD_NAME: string;
        CLOUDINARY_API_KEY: string;
        CLOUDINARY_API_SECRET: string;
    };
    ADMIN_EMAIL: string;
    ADMIN_PASSWORD: string;
    // Optional Bangladesh E-Commerce Integrations (Courier, Payment, SMS, Meta CAPI)
    COURIER: {
        STEADFAST_API_KEY?: string;
        STEADFAST_SECRET_KEY?: string;
        STEADFAST_BASE_URL?: string;
        PATHAO_CLIENT_ID?: string;
        PATHAO_CLIENT_SECRET?: string;
        PATHAO_USERNAME?: string;
        PATHAO_PASSWORD?: string;
        PATHAO_BASE_URL?: string;
        REDX_ACCESS_TOKEN?: string;
        REDX_BASE_URL?: string;
        FRAUD_CHECKER_API_KEY?: string;
    };
    PAYMENT: {
        BKASH_APP_KEY?: string;
        BKASH_APP_SECRET?: string;
        BKASH_USERNAME?: string;
        BKASH_PASSWORD?: string;
        BKASH_BASE_URL?: string;
        SSLCOMMERZ_STORE_ID?: string;
        SSLCOMMERZ_STORE_PASSWORD?: string;
        SSLCOMMERZ_IS_LIVE?: string;
    };
    SMS: {
        SMS_API_KEY?: string;
        SMS_SENDER_ID?: string;
        SMS_API_URL?: string;
    };
    META: {
        META_PIXEL_ID?: string;
        META_CAPI_ACCESS_TOKEN?: string;
    };
    RESEND: {
        API_KEY?: string;
        FROM_EMAIL?: string;
    };
}

const loadEnvVariables = (): EnvConfig => {
    const requireEnvVariable = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'BETTER_AUTH_SECRET',
        'BETTER_AUTH_URL',
        'BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN',
        'BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE',
        'EMAIL_SENDER_SMTP_USER',
        'EMAIL_SENDER_SMTP_PASS',
        'EMAIL_SENDER_SMTP_HOST',
        'EMAIL_SENDER_SMTP_PORT',
        'EMAIL_SENDER_SMTP_FROM',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CALLBACK_URL',
        'FRONTEND_URL',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'ADMIN_EMAIL',
        'ADMIN_PASSWORD',
    ];

    requireEnvVariable.forEach((variable) => {
        if (!process.env[variable]) {
            throw new AppError(
                status.INTERNAL_SERVER_ERROR,
                `Environment variable ${variable} is required but not set in .env file.`
            );
        }
    });

    return {
        NODE_ENV: process.env.NODE_ENV as string,
        PORT: process.env.PORT as string,
        DATABASE_URL: process.env.DATABASE_URL as string,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL as string,
        BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: process.env.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN as string,
        BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: process.env.BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE as string,
        EMAIL_SENDER: {
            SMTP_USER: process.env.EMAIL_SENDER_SMTP_USER as string,
            SMTP_PASS: process.env.EMAIL_SENDER_SMTP_PASS as string,
            SMTP_HOST: process.env.EMAIL_SENDER_SMTP_HOST as string,
            SMTP_PORT: process.env.EMAIL_SENDER_SMTP_PORT as string,
            SMTP_FROM: process.env.EMAIL_SENDER_SMTP_FROM as string,
        },
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
        GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
        FRONTEND_URL: process.env.FRONTEND_URL as string,
        CLOUDINARY: {
            CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
            CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
            CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
        },
        ADMIN_EMAIL: process.env.ADMIN_EMAIL as string,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD as string,
        COURIER: {
            STEADFAST_API_KEY: process.env.STEADFAST_API_KEY,
            STEADFAST_SECRET_KEY: process.env.STEADFAST_SECRET_KEY,
            STEADFAST_BASE_URL: process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1',
            PATHAO_CLIENT_ID: process.env.PATHAO_CLIENT_ID,
            PATHAO_CLIENT_SECRET: process.env.PATHAO_CLIENT_SECRET,
            PATHAO_USERNAME: process.env.PATHAO_USERNAME,
            PATHAO_PASSWORD: process.env.PATHAO_PASSWORD,
            PATHAO_BASE_URL: process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com',
            REDX_ACCESS_TOKEN: process.env.REDX_ACCESS_TOKEN,
            REDX_BASE_URL: process.env.REDX_BASE_URL || 'https://openapi.redx.com.bd/v1.0.0-beta',
            FRAUD_CHECKER_API_KEY: process.env.FRAUD_CHECKER_API_KEY,
        },
        PAYMENT: {
            BKASH_APP_KEY: process.env.BKASH_APP_KEY,
            BKASH_APP_SECRET: process.env.BKASH_APP_SECRET,
            BKASH_USERNAME: process.env.BKASH_USERNAME,
            BKASH_PASSWORD: process.env.BKASH_PASSWORD,
            BKASH_BASE_URL: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
            SSLCOMMERZ_STORE_ID: process.env.SSLCOMMERZ_STORE_ID,
            SSLCOMMERZ_STORE_PASSWORD: process.env.SSLCOMMERZ_STORE_PASSWORD,
            SSLCOMMERZ_IS_LIVE: process.env.SSLCOMMERZ_IS_LIVE || 'false',
        },
        SMS: {
            SMS_API_KEY: process.env.SMS_API_KEY,
            SMS_SENDER_ID: process.env.SMS_SENDER_ID,
            SMS_API_URL: process.env.SMS_API_URL,
        },
        META: {
            META_PIXEL_ID: process.env.META_PIXEL_ID,
            META_CAPI_ACCESS_TOKEN: process.env.META_CAPI_ACCESS_TOKEN,
        },
        RESEND: {
            API_KEY: process.env.RESEND_API_KEY,
            FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
        },
    };
};

export const envVars = loadEnvVariables();
