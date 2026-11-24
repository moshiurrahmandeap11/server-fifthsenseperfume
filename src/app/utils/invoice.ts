/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from "pdfkit";
import { envVars } from "../config/env";
import { prisma } from "../lib/prisma";
import { sendEmail } from "./email";

export interface InvoiceOrderItem {
    productName: string;
    colorName?: string | null;
    size: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface InvoiceOrderData {
    id: string;
    orderNumber: string;
    userId?: string | null;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    shippingAddress: string;
    division: string;
    district: string;
    thana: string;
    subtotal: number;
    discountAmount: number;
    couponCode?: string | null;
    shippingCharge: number;
    totalAmount: number;
    advancePaidAmount: number;
    codCollectibleAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: Date | string;
    items: InvoiceOrderItem[];
}

const formatPaymentMethodLabel = (method: string): string => {
    if (method === "STRIPE") return "Card Payment (Stripe)";
    if (method === "COD") return "Cash on Delivery";
    return method;
};

/**
 * Generate a clean A4 PDF Invoice Buffer for an order
 */
export const generateOrderInvoicePdf = (order: InvoiceOrderData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 48 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Header
        doc.fontSize(18).fillColor("#09090b").text("FIFTH SENSE PERFUMES", { align: "left" });
        doc.fontSize(9).fillColor("#71717a").text("Artisanal Luxury Fragrances", { align: "left" });

        doc.moveUp(2);
        doc.fontSize(16).fillColor("#09090b").text("INVOICE", { align: "right" });
        doc.fontSize(9).fillColor("#52525b").text(`#${order.orderNumber}`, { align: "right" });
        doc.text(
            `Date: ${new Date(order.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })}`,
            { align: "right" }
        );

        doc.moveDown(1.5);
        doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor("#e4e4e7").stroke();
        doc.moveDown(1);

        // Billing & Payment Info
        const infoTop = doc.y;
        doc.fontSize(9).fillColor("#71717a").text("BILLED & SHIPPED TO", 48, infoTop);
        doc.fontSize(10).fillColor("#09090b").text(order.customerName, 48, infoTop + 14);
        doc.fontSize(9)
            .fillColor("#3f3f46")
            .text(order.customerPhone, 48, infoTop + 28)
            .text(
                `${order.shippingAddress}, ${order.thana}, ${order.district}, ${order.division}`,
                48,
                infoTop + 42,
                { width: 260 }
            );

        doc.fontSize(9).fillColor("#71717a").text("PAYMENT DETAILS", 340, infoTop);
        doc.fontSize(9)
            .fillColor("#09090b")
            .text(`Method: ${formatPaymentMethodLabel(order.paymentMethod)}`, 340, infoTop + 14)
            .text(`Status: ${order.paymentStatus}`, 340, infoTop + 28);

        doc.y = Math.max(doc.y, infoTop + 78);
        doc.moveDown(1);

        // Table Header
        const tableTop = doc.y;
        doc.rect(48, tableTop, 499, 22).fill("#09090b");
        doc.fillColor("#ffffff").fontSize(9);
        doc.text("ITEM", 56, tableTop + 7, { width: 250 });
        doc.text("QTY", 320, tableTop + 7, { width: 50, align: "center" });
        doc.text("UNIT PRICE", 380, tableTop + 7, { width: 75, align: "right" });
        doc.text("TOTAL", 465, tableTop + 7, { width: 74, align: "right" });

        let rowY = tableTop + 28;
        order.items.forEach((item) => {
            doc.fillColor("#09090b").fontSize(9.5).text(item.productName, 56, rowY, { width: 250 });
            const variantLine = [item.size, item.colorName].filter(Boolean).join(" • ");
            if (variantLine) {
                doc.fillColor("#71717a").fontSize(8).text(variantLine, 56, rowY + 12, { width: 250 });
            }
            doc.fillColor("#09090b")
                .fontSize(9.5)
                .text(String(item.quantity), 320, rowY, { width: 50, align: "center" })
                .text(`BDT ${Number(item.unitPrice).toLocaleString()}`, 380, rowY, {
                    width: 75,
                    align: "right",
                })
                .text(`BDT ${Number(item.totalPrice).toLocaleString()}`, 465, rowY, {
                    width: 74,
                    align: "right",
                });

            rowY += variantLine ? 32 : 24;
            doc.moveTo(48, rowY - 4).lineTo(547, rowY - 4).strokeColor("#f4f4f5").stroke();
        });

        // Summary Totals
        rowY += 12;
        const summaryLabelX = 350;
        const summaryValueX = 455;
        const summaryWidth = 92;

        const addSummaryRow = (label: string, value: string, bold = false) => {
            doc.fontSize(bold ? 10.5 : 9.5)
                .fillColor(bold ? "#09090b" : "#52525b")
                .text(label, summaryLabelX, rowY, { width: 100 });
            doc.fillColor("#09090b").text(value, summaryValueX, rowY, {
                width: summaryWidth,
                align: "right",
            });
            rowY += bold ? 20 : 16;
        };

        addSummaryRow("Subtotal", `BDT ${Number(order.subtotal).toLocaleString()}`);
        if (Number(order.discountAmount) > 0) {
            addSummaryRow(
                `Discount${order.couponCode ? ` (${order.couponCode})` : ""}`,
                `-BDT ${Number(order.discountAmount).toLocaleString()}`
            );
        }
        addSummaryRow(
            "Delivery Charge",
            Number(order.shippingCharge) === 0
                ? "Free"
                : `BDT ${Number(order.shippingCharge).toLocaleString()}`
        );

        doc.moveTo(summaryLabelX, rowY).lineTo(547, rowY).strokeColor("#e4e4e7").stroke();
        rowY += 8;
        addSummaryRow("Total Amount", `BDT ${Number(order.totalAmount).toLocaleString()}`, true);

        if (Number(order.advancePaidAmount) > 0) {
            addSummaryRow("Paid Online", `BDT ${Number(order.advancePaidAmount).toLocaleString()}`);
        }
        if (Number(order.codCollectibleAmount) > 0) {
            addSummaryRow("COD Due", `BDT ${Number(order.codCollectibleAmount).toLocaleString()}`);
        }

        // Footer
        doc.fontSize(8.5)
            .fillColor("#71717a")
            .text("Thank you for choosing FIFTH SENSE PERFUMES.", 48, 760, {
                align: "center",
                width: 499,
            });

        doc.end();
    });
};

/**
 * Send order confirmation / payment receipt email with PDF invoice attached
 */
export const sendOrderInvoiceEmail = async (
    order: InvoiceOrderData,
    options?: { isPaymentReceipt?: boolean }
) => {
    try {
        let recipientEmail = order.customerEmail?.trim() || "";

        if (!recipientEmail && order.userId) {
            const user = await prisma.user.findUnique({
                where: { id: order.userId },
                select: { email: true },
            });
            recipientEmail = user?.email?.trim() || "";
        }

        if (!recipientEmail) {
            return;
        }

        const pdfBuffer = await generateOrderInvoicePdf(order);
        const isPaymentReceipt = Boolean(options?.isPaymentReceipt);

        const subject = isPaymentReceipt
            ? `Payment Confirmed & Invoice #${order.orderNumber} — FIFTH SENSE PERFUMES`
            : `Order Confirmed & Invoice #${order.orderNumber} — FIFTH SENSE PERFUMES`;

        await sendEmail({
            to: recipientEmail,
            subject,
            templateName: "orderInvoice",
            templateData: {
                isPaymentReceipt,
                orderNumber: order.orderNumber,
                orderDate: new Date(order.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                }),
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                shippingAddress: order.shippingAddress,
                thana: order.thana,
                district: order.district,
                division: order.division,
                paymentMethodLabel: formatPaymentMethodLabel(order.paymentMethod),
                paymentStatus: order.paymentStatus,
                subtotal: order.subtotal,
                discountAmount: order.discountAmount,
                couponCode: order.couponCode,
                shippingCharge: order.shippingCharge,
                totalAmount: order.totalAmount,
                advancePaidAmount: order.advancePaidAmount,
                codCollectibleAmount: order.codCollectibleAmount,
                items: order.items,
                ordersUrl: `${envVars.FRONTEND_URL}/customer/orders`,
            },
            attachments: [
                {
                    filename: `Invoice-${order.orderNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });
    } catch (err: any) {
        console.error(
            `[InvoiceEmail] Failed to send invoice email for order ${order.orderNumber}:`,
            err?.message || err
        );
    }
};
// Invoice generator revision 1
// Invoice generator revision 4
// Invoice generator revision 7
// Invoice generator revision 10
// Invoice generator revision 13
// Invoice generator revision 16
