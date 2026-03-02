import type { FastifyPluginAsync } from "fastify";

const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/payments/yookassa/webhook", async () => {
    return { ok: true, message: "Webhook endpoint alive. Use POST from YooKassa events." };
  });

  app.post("/payments/yookassa/webhook", async (request) => {
    const payload = request.body as
      | {
          event?: string;
          object?: {
            id?: string;
            status?: string;
            metadata?: {
              orderId?: string;
            };
          };
        }
      | undefined;

    const event = payload?.event;
    const paymentId = payload?.object?.id;
    const paymentStatus = payload?.object?.status;
    const metadataOrderId = payload?.object?.metadata?.orderId;

    if (!paymentId && !metadataOrderId) {
      return { ok: true };
    }

    const order = await app.prisma.order.findFirst({
      where: paymentId
        ? { yookassaPaymentId: paymentId }
        : {
            id: metadataOrderId,
          },
      select: {
        id: true,
      },
    });

    if (!order) {
      return { ok: true };
    }

    if (event === "payment.succeeded" || paymentStatus === "succeeded") {
      await app.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "SUCCEEDED",
          status: "PAID",
        },
      });
      return { ok: true };
    }

    if (event === "payment.canceled" || paymentStatus === "canceled") {
      await app.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "CANCELED",
          status: "CANCELLED",
        },
      });
      return { ok: true };
    }

    if (paymentStatus === "pending") {
      await app.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PENDING",
          status: "AWAITING_PAYMENT",
        },
      });
    }

    return { ok: true };
  });
};

export default paymentRoutes;
