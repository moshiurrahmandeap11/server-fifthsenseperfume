import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ExchangeController } from "./exchange.controller";
import { ExchangeValidation } from "./exchange.validation";

const router = Router();

// 1. Submit Size Exchange / Defect Return Request (Public / Customer)
router.post(
    "/request",
    validateRequest(ExchangeValidation.createExchangeRequestZodSchema),
    ExchangeController.createExchangeRequest
);

// 2. Warehouse Returns Pending QC Queue (Must be defined before /:id)
router.get(
    "/pending-qc",
    checkAuth(
        Role.INVENTORY_STAFF,
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR
    ),
    ExchangeController.getPendingQcExchanges
);

// 3. Mark Returned Shoe Parcel Received at Warehouse Gate
router.put(
    "/:id/receive-parcel",
    checkAuth(
        Role.INVENTORY_STAFF,
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR
    ),
    ExchangeController.receiveReturnedParcel
);

// 4. Warehouse QC Decision (Restock or Damaged write-off)
router.put(
    "/:id/qc-decision",
    checkAuth(Role.INVENTORY_STAFF, Role.SUPER_ADMIN, Role.ADMIN),
    validateRequest(ExchangeValidation.exchangeQcDecisionZodSchema),
    ExchangeController.decideReturnQc
);

// 5. Moderator Unified Exchange Decision (Approve / Reject)
router.put(
    "/:id/status",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    validateRequest(ExchangeValidation.exchangeStatusDecisionZodSchema),
    ExchangeController.decideExchangeStatus
);

// 6. Single Exchange Request Details
router.get(
    "/:id",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR,
        Role.INVENTORY_STAFF
    ),
    ExchangeController.getExchangeById
);

// 7. List All Exchanges with QueryBuilder (search, filter, sort, paginate)
router.get(
    "/",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR,
        Role.ACCOUNTANT
    ),
    ExchangeController.getAllExchanges
);

export const ExchangeRoutes = router;

