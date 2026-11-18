import {
    ExpenseCategory,
    PaymentMethod,
    PaymentTransactionType,
} from "../../../generated/prisma/enums";

export interface IInitiatePaymentPayload {
    orderId: string;
    method: PaymentMethod;
    transactionType: PaymentTransactionType;
    callbackUrl?: string;
}

export interface IBkashCallbackPayload {
    paymentID: string;
    status: string;
    [key: string]: unknown;
}

export interface ISSLCommerzCallbackPayload {
    tran_id: string;
    val_id?: string;
    amount?: number | string;
    status?: string;
    bank_tran_id?: string;
    card_type?: string;
    card_issuer?: string;
    [key: string]: unknown;
}

export interface IMarkReconciledPayload {
    shipmentIds: string[];
    note?: string;
}

export interface ICreateExpensePayload {
    category: ExpenseCategory;
    title: string;
    amount: number;
    date: string | Date;
    note?: string;
}

export interface IUpdateExpensePayload {
    category?: ExpenseCategory;
    title?: string;
    amount?: number;
    date?: string | Date;
    note?: string;
}

