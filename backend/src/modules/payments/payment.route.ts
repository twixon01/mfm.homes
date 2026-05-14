import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";

const yookassaWebhookSchema = z.object({
  event: z.string().optional(),
  object: z.object({
    id: z.string().min(1),
  }),
});

type YooKassaPaymentResponse = {
  id: string;
  status: string;
  amount?: {
    value?: string;
    currency?: string;
  };
  metadata?: {
    orderId?: string;
    userId?: string;
  };
};

function normalizePaymentStatus(status: string): "PENDING" | "SUCCEEDED" | "CANCELED" | "FAILED" {
  if (status === "succeeded") return "SUCCEEDED";
  if (status === "canceled") return "CANCELED";
  if (status === "pending" || status === "waiting_for_capture") return "PENDING";
  return "FAILED";
}

function mapOrderStatus(paymentStatus: "PENDING" | "SUCCEEDED" | "CANCELED" | "FAILED") {
  if (paymentStatus === "SUCCEEDED") return "PAID" as const;
  if (paymentStatus === "PENDING") return "AWAITING_PAYMENT" as const;
  return "CANCELLED" as const;
}

const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/payments/yookassa/webhook", async () => {
    return { ok: true, message: "Webhook endpoint alive. Use POST from YooKassa events." };
  });

  app.post("/payments/yookassa/webhook", async (request) => {
    const parsed = yookassaWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ body: request.body }, "YooKassa webhook payload validation failed");
      return { ok: true };
    }

    const paymentId = parsed.data.object.id;

    const order = await app.prisma.order.findFirst({
      where: { yookassaPaymentId: paymentId },
      select: {
        id: true,
        userId: true,
        totalRub: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      return { ok: true };
    }

    if (!env.YOOKASSA_SHOP_ID || !env.YOOKASSA_SECRET_KEY) {
      request.log.error("YooKassa webhook rejected: credentials are not configured");
      throw app.httpErrors.failedDependency("ЮKassa не настроена");
    }

    const auth = Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString("base64");

    let paymentResponseRaw: Response;
    try {
      paymentResponseRaw = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
    } catch (error) {
      request.log.error({ error, paymentId, orderId: order.id }, "YooKassa webhook verify request failed");
      throw app.httpErrors.badGateway("Не удалось верифицировать платеж в ЮKassa");
    }

    if (!paymentResponseRaw.ok) {
      const details = await paymentResponseRaw.text().catch(() => "");
      request.log.error(
        { status: paymentResponseRaw.status, statusText: paymentResponseRaw.statusText, details, paymentId, orderId: order.id },
        "YooKassa webhook verify failed",
      );
      throw app.httpErrors.badGateway("Не удалось верифицировать платеж в ЮKassa");
    }

    const verifiedPayment = (await paymentResponseRaw.json()) as YooKassaPaymentResponse;
    if (verifiedPayment.id !== paymentId) {
      request.log.warn({ paymentId, verifiedPaymentId: verifiedPayment.id, orderId: order.id }, "Payment ID mismatch in webhook");
      return { ok: true };
    }

    const verifiedOrderId = verifiedPayment.metadata?.orderId;
    if (verifiedOrderId && verifiedOrderId !== order.id) {
      request.log.warn({ paymentId, orderId: order.id, verifiedOrderId }, "Order ID mismatch in verified payment metadata");
      return { ok: true };
    }

    const expectedAmount = order.totalRub.toFixed(2);
    if (verifiedPayment.amount?.currency !== "RUB" || verifiedPayment.amount?.value !== expectedAmount) {
      request.log.warn(
        {
          paymentId,
          orderId: order.id,
          expectedAmount,
          actualAmount: verifiedPayment.amount?.value,
          actualCurrency: verifiedPayment.amount?.currency,
        },
        "Payment amount mismatch in webhook",
      );
      return { ok: true };
    }

    const normalizedStatus = normalizePaymentStatus(verifiedPayment.status);
    if (order.paymentStatus === "SUCCEEDED" && normalizedStatus !== "SUCCEEDED") {
      request.log.warn(
        { paymentId, orderId: order.id, currentStatus: order.paymentStatus, nextStatus: normalizedStatus },
        "Ignoring payment status downgrade for succeeded order",
      );
      return { ok: true };
    }

    await app.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: normalizedStatus,
        status: mapOrderStatus(normalizedStatus),
      },
    });

    return { ok: true };
  });
};

export default paymentRoutes;
