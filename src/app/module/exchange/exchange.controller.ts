import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ExchangeService } from "./exchange.service";

const createExchangeRequest = catchAsync(async (req: Request, res: Response) => {
    const result = await ExchangeService.createExchangeRequest(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Size exchange / return request submitted successfully",
        data: result,
    });
});

const getAllExchanges = catchAsync(async (req: Request, res: Response) => {
    const result = await ExchangeService.getAllExchanges(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Exchange requests retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getExchangeById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ExchangeService.getExchangeById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Exchange request details retrieved successfully",
        data: result,
    });
});

const decideExchangeStatus = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await ExchangeService.decideExchangeStatus(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Exchange request decision processed: ${req.body.status}`,
        data: result,
    });
});

const getPendingQcExchanges = catchAsync(async (req: Request, res: Response) => {
    const result = await ExchangeService.getPendingQcExchanges(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Pending return QC queue retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const receiveReturnedParcel = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await ExchangeService.receiveReturnedParcel(id, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Returned parcel marked as received at warehouse gate",
        data: result,
    });
});

const decideReturnQc = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await ExchangeService.decideReturnQc(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Warehouse QC decision recorded: ${req.body.decision}`,
        data: result,
    });
});

export const ExchangeController = {
    createExchangeRequest,
    getAllExchanges,
    getExchangeById,
    decideExchangeStatus,
    getPendingQcExchanges,
    receiveReturnedParcel,
    decideReturnQc,
};

