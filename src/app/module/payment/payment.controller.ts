import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.initiatePayment(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Payment session initiated successfully",
        data: result,
    });
});

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
    // In bKash Tokenized flow, parameters may come in body or query params
    const payload = { ...req.query, ...req.body };
    const result = await PaymentService.handleBkashCallback(payload as any);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: result.success,
        message: result.message,
        data: result,
    });
});

const handleSSLCommerzSuccess = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.handleSSLCommerzSuccess(req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: result.success,
        message: result.message,
        data: result,
    });
});

const handleSSLCommerzFail = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.handleSSLCommerzFailOrCancel(req.body, "FAILED");

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: false,
        message: result.message,
        data: result,
    });
});

const handleSSLCommerzCancel = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.handleSSLCommerzFailOrCancel(req.body, "CANCELLED");

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: false,
        message: result.message,
        data: result,
    });
});

const getAllTransactions = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.getAllTransactions(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Payment transactions retrieved successfully",
        meta: result.meta,
        data: {
            transactions: result.data,
            totalPaidRevenue: result.totalPaidRevenue,
        },
    });
});

const getCourierReconciliation = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.getCourierReconciliation(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Courier payout reconciliation report retrieved successfully",
        meta: result.meta,
        data: {
            summary: result.summary,
            shipments: result.data,
        },
    });
});

const markShipmentsReconciled = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId;
    const result = await PaymentService.markShipmentsReconciled(req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

const createExpense = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId;
    const result = await PaymentService.createExpense(req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Expense entry created successfully",
        data: result,
    });
});

const getAllExpenses = catchAsync(async (req: Request, res: Response) => {
    const result = await PaymentService.getAllExpenses(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Daily expenses retrieved successfully",
        meta: result.meta,
        data: {
            expenses: result.data,
            totalExpenseAmount: result.totalExpenseAmount,
        },
    });
});

const updateExpense = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await PaymentService.updateExpense(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Expense entry updated successfully",
        data: result,
    });
});

const deleteExpense = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await PaymentService.deleteExpense(id, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

const verifyStripeSession = catchAsync(async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const result = await PaymentService.verifyStripeSession(sessionId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: result.success,
        message: result.message,
        data: result,
    });
});

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = (req.headers["stripe-signature"] as string) || "";
    const result = await PaymentService.handleStripeWebhook(req.body as Buffer, signature);

    res.status(status.OK).json(result);
});

export const PaymentController = {
    initiatePayment,
    verifyStripeSession,
    handleStripeWebhook,
    handleBkashCallback,
    handleSSLCommerzSuccess,
    handleSSLCommerzFail,
    handleSSLCommerzCancel,
    getAllTransactions,
    getCourierReconciliation,
    markShipmentsReconciled,
    createExpense,
    getAllExpenses,
    updateExpense,
    deleteExpense,
};

