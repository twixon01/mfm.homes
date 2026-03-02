import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { ZodError } from "zod";

import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import adminRoutes from "./modules/admin/admin.route.js";
import authRoutes from "./modules/auth/auth.route.js";
import devRoutes from "./modules/dev/dev.route.js";
import orderRoutes from "./modules/orders/order.route.js";
import paymentRoutes from "./modules/payments/payment.route.js";
import productRoutes from "./modules/products/product.route.js";
import userRoutes from "./modules/users/user.route.js";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.decorate("prisma", prisma);

  app.register(cors, {
    origin: true,
    credentials: true,
  });
  app.register(sensible);
  app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  app.get("/health", async () => ({ ok: true }));

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(productRoutes, { prefix: "/api" });
  app.register(orderRoutes, { prefix: "/api" });
  app.register(paymentRoutes, { prefix: "/api" });
  app.register(userRoutes, { prefix: "/api/users" });
  app.register(adminRoutes, { prefix: "/api/admin" });
  if (env.NODE_ENV !== "production") {
    app.register(devRoutes);
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Ошибка валидации входных данных",
        issues: error.issues,
      });
    }

    const appError = error as { statusCode?: number; message?: string };
    if (appError.statusCode) {
      return reply.status(appError.statusCode).send({
        message: appError.message ?? "Ошибка запроса",
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      message: "Внутренняя ошибка сервера",
    });
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
