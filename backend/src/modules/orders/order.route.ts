import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../../config/env";
import { requireAuth } from "../../lib/auth";
import { createOrderSchema, orderParamsSchema } from "./order.schema";

type YooKassaPaymentResponse = {
  id: string;
  status: string;
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  };
};

const SHIPPING_RUB = 4000;

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.post("/orders", { preHandler: requireAuth }, async (request, reply) => {
    const { items } = createOrderSchema.parse(request.body);

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const products = await app.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        brand: true,
        priceRub: true,
        images: true,
      },
    });

    if (products.length !== productIds.length) {
      throw app.httpErrors.badRequest("Некоторые товары не найдены или недоступны");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw app.httpErrors.badRequest(`Товар ${item.productId} не найден`);
      }
      return {
        productId: product.id,
        nameSnapshot: product.name,
        priceRub: product.priceRub,
        qty: item.qty,
        size: item.size ?? null,
        brand: product.brand,
        imageUrl: product.images[0] ?? null,
      };
    });

    const subtotalRub = orderItems.reduce((sum, item) => sum + item.priceRub * item.qty, 0);
    const shippingRub = subtotalRub > 0 ? SHIPPING_RUB : 0;
    const totalRub = subtotalRub + shippingRub;

    const order = await app.prisma.order.create({
      data: {
        userId: request.user.sub,
        status: "AWAITING_PAYMENT",
        paymentStatus: "PENDING",
        subtotalRub,
        shippingRub,
        totalRub,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    });

    return reply.code(201).send({ order });
  });

  app.get("/orders", { preHandler: requireAuth }, async (request) => {
    const orders = await app.prisma.order.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    return { orders };
  });

  app.get("/orders/:orderId", { preHandler: requireAuth }, async (request) => {
    const { orderId } = orderParamsSchema.parse(request.params);
    const order = await app.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: request.user.sub,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw app.httpErrors.notFound("Заказ не найден");
    }

    return { order };
  });

  app.post("/orders/:orderId/pay", { preHandler: requireAuth }, async (request) => {
    const { orderId } = orderParamsSchema.parse(request.params);

    const order = await app.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: request.user.sub,
      },
    });

    if (!order) {
      throw app.httpErrors.notFound("Заказ не найден");
    }

    if (order.paymentStatus === "SUCCEEDED") {
      return {
        paymentId: order.yookassaPaymentId,
        status: "succeeded",
        confirmationUrl: null,
        message: "Заказ уже оплачен",
      };
    }

    if (!env.YOOKASSA_SHOP_ID || !env.YOOKASSA_SECRET_KEY) {
      throw app.httpErrors.failedDependency("ЮKassa не настроена: укажи YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY");
    }

    const amountValue = order.totalRub.toFixed(2);
    const returnUrl = env.YOOKASSA_RETURN_URL ?? `${env.APP_BASE_URL}/orders`;
    const auth = Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString("base64");

    let paymentResponseRaw: Response;
    try {
      paymentResponseRaw = await fetch("https://api.yookassa.ru/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "Idempotence-Key": randomUUID(),
        },
        body: JSON.stringify({
          amount: {
            value: amountValue,
            currency: "RUB",
          },
          capture: true,
          confirmation: {
            type: "redirect",
            return_url: returnUrl,
          },
          description: `MFM order ${order.id}`,
          metadata: {
            orderId: order.id,
            userId: order.userId,
          },
        }),
      });
    } catch (error) {
      request.log.error({ error }, "YooKassa request failed");
      throw app.httpErrors.badGateway("Не удалось подключиться к ЮKassa");
    }

    if (!paymentResponseRaw.ok) {
      const details = await paymentResponseRaw.text().catch(() => "");
      request.log.error(
        { status: paymentResponseRaw.status, statusText: paymentResponseRaw.statusText, details },
        "YooKassa create payment failed",
      );
      throw app.httpErrors.badGateway(
        `ЮKassa вернула ошибку (${paymentResponseRaw.status}). Проверь SHOP_ID / SECRET_KEY и режим (тест/боевой).`,
      );
    }

    const paymentResponse = (await paymentResponseRaw.json()) as YooKassaPaymentResponse;
    const normalizedPaymentStatus =
      paymentResponse.status === "succeeded"
        ? "SUCCEEDED"
        : paymentResponse.status === "canceled"
          ? "CANCELED"
          : "PENDING";

    const updatedOrder = await app.prisma.order.update({
      where: { id: order.id },
      data: {
        yookassaPaymentId: paymentResponse.id,
        paymentStatus: normalizedPaymentStatus,
        status: normalizedPaymentStatus === "SUCCEEDED" ? "PAID" : "AWAITING_PAYMENT",
      },
    });

    return {
      paymentId: updatedOrder.yookassaPaymentId,
      status: paymentResponse.status,
      confirmationUrl: paymentResponse.confirmation?.confirmation_url ?? null,
    };
  });
};

export default orderRoutes;
