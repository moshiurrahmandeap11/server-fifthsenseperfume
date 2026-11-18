import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CourierService } from "./courier.service";

const checkFraud = catchAsync(async (req: Request, res: Response) => {
    const phone = req.params.phone as string;
    const result = await CourierService.checkFraud(phone);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Customer courier delivery ratio & fraud score evaluated successfully",
        data: result,
    });
});

const bookCourier = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId;
    const result = await CourierService.bookCourier(req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: `Successfully booked ${result.length} order(s) with courier gateway`,
        data: result,
    });
});

const trackShipment = catchAsync(async (req: Request, res: Response) => {
    const idOrCode = req.params.idOrCode as string;
    const result = await CourierService.trackShipment(idOrCode);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipment tracking details retrieved successfully",
        data: result,
    });
});

const getAllShipments = catchAsync(async (req: Request, res: Response) => {
    const result = await CourierService.getAllShipments(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Courier shipments retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const handleSteadfastWebhook = catchAsync(async (req: Request, res: Response) => {
    const result = await CourierService.handleSteadfastWebhook(req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

const handlePathaoWebhook = catchAsync(async (req: Request, res: Response) => {
    const result = await CourierService.handlePathaoWebhook(req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

const getShippingZones = catchAsync(async (_req: Request, res: Response) => {
    const result = await CourierService.getShippingZones();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipping zone rules retrieved successfully",
        data: result,
    });
});

const updateShippingZone = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await CourierService.updateShippingZone(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipping zone rule updated successfully",
        data: result,
    });
});

export const CourierController = {
    checkFraud,
    bookCourier,
    trackShipment,
    getAllShipments,
    handleSteadfastWebhook,
    handlePathaoWebhook,
    getShippingZones,
    updateShippingZone,
};
