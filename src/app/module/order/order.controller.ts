import { Request, Response } from "express";
import status from "http-status";
import { OrderSource } from "../../../generated/prisma/enums";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { OrderService } from "./order.service";

const checkoutOrder = catchAsync(async (req: Request, res: Response) => {
    const clientIp = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress;
    const clientUserAgent = req.headers["user-agent"];
    const result = await OrderService.checkoutOrder(req.body, req.user, clientIp, clientUserAgent);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Order placed successfully",
        data: result,
    });
});

const incompleteCapture = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.incompleteCapture(req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Incomplete order captured successfully",
        data: result,
    });
});

const getIncompleteOrders = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getIncompleteOrders(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Incomplete orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const convertIncompleteOrder = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId as string;
    const result = await OrderService.convertIncompleteOrder(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Incomplete order converted to active order successfully",
        data: result,
    });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getAllOrders(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getOrderById = catchAsync(async (req: Request, res: Response) => {
    const idOrOrderNumber = req.params.id as string;
    const result = await OrderService.getOrderById(idOrOrderNumber, req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order details retrieved successfully",
        data: result,
    });
});

const createManualOrder = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId as string;
    const payload = {
        ...req.body,
        source: req.body.source || OrderSource.PHONE_CALL,
    };
    const result = await OrderService.checkoutOrder(payload, { userId: staffId, role: req.user!.role, email: req.user!.email });

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Manual order created successfully",
        data: result,
    });
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId as string;
    const result = await OrderService.updateOrderStatus(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Order status updated to ${req.body.status} successfully`,
        data: result,
    });
});

const updateOrder = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId as string;
    const result = await OrderService.updateOrder(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order items and details updated successfully",
        data: result,
    });
});

const bulkStatusUpdate = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId as string;
    const result = await OrderService.bulkStatusUpdate(req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Bulk status update completed for ${result.totalUpdated} orders`,
        data: result,
    });
});

const scanVerifyPack = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId as string;
    const result = await OrderService.scanVerifyPack(req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

const trackPublicOrder = catchAsync(async (req: Request, res: Response) => {
    const orderNumber = String(req.query.orderNumber || "");
    const phone = String(req.query.phone || "");
    const result = await OrderService.trackPublicOrder(orderNumber, phone);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order tracking information retrieved successfully",
        data: result,
    });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const result = await OrderService.getMyOrders(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Customer orders retrieved successfully",
        data: result,
    });
});

export const OrderController = {
    checkoutOrder,
    incompleteCapture,
    getIncompleteOrders,
    convertIncompleteOrder,
    getAllOrders,
    getOrderById,
    createManualOrder,
    updateOrderStatus,
    updateOrder,
    bulkStatusUpdate,
    scanVerifyPack,
    trackPublicOrder,
    getMyOrders,
};

