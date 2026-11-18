import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// 1. Online Payment Session Initiation (Public / Customer)
router.post(
    "/initiate",
    validateRequest(PaymentValidation.initiatePaymentZodSchema),
    PaymentController.initiatePayment
);

// 2. bKash Tokenized Callback (Supports POST & GET redirects)
router.post("/bkash/callback", PaymentController.handleBkashCallback);
router.get("/bkash/callback", PaymentController.handleBkashCallback);

// 3. SSLCommerz Success / Fail / Cancel Webhooks & IPNs
router.post("/sslcommerz/success", PaymentController.handleSSLCommerzSuccess);
router.post("/sslcommerz/fail", PaymentController.handleSSLCommerzFail);
router.post("/sslcommerz/cancel", PaymentController.handleSSLCommerzCancel);

// 4. Payment Transactions Directory (Accountant, Admin, Super Admin)
router.get(
    "/transactions",
    checkAuth(Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN),
    PaymentController.getAllTransactions
);

// 5. Courier Payout Reconciliation Dashboard
router.get(
    "/courier-reconciliation",
    checkAuth(Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN),
    PaymentController.getCourierReconciliation
);

// 6. Mark Courier Shipments as Reconciled
router.put(
    "/courier-reconciliation/mark-reconciled",
    checkAuth(Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(PaymentValidation.markReconciledZodSchema),
    PaymentController.markShipmentsReconciled
);

// 7. Daily & Ad Expenses Tracking
router.post(
    "/expenses",
    checkAuth(Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(PaymentValidation.createExpenseZodSchema),
    PaymentController.createExpense
);

router.get(
    "/expenses",
    checkAuth(Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN),
    PaymentController.getAllExpenses
);

router.put(
    "/expenses/:id",
    checkAuth(Role.ACCOUNTANT, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(PaymentValidation.updateExpenseZodSchema),
    PaymentController.updateExpense
);

router.delete(
    "/expenses/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    PaymentController.deleteExpense
);

export const PaymentRoutes = router;

