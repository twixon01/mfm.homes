import { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { requireAdmin } from "../../lib/auth.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  productParamsSchema,
  updateProductSchema,
} from "../products/product.schema.js";
import { changeRoleSchema } from "../users/user.schema.js";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", { preHandler: requireAdmin }, async () => {
    const users = await app.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });

    return { users };
  });

  app.patch("/users/:userId/role", { preHandler: requireAdmin }, async (request) => {
    const { userId } = paramsSchema.parse(request.params);
    const payload = changeRoleSchema.parse(request.body);

    if (userId === request.user.sub) {
      throw app.httpErrors.badRequest("Нельзя изменить роль самому себе");
    }

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: { role: payload.role },
      select: {
        id: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return { user: updated };
  });

  app.get("/products", { preHandler: requireAdmin }, async (request) => {
    const query = listProductsQuerySchema.parse(request.query);
    const products = await app.prisma.product.findMany({
      where: {
        category: query.category,
        isActive: query.includeInactive ? undefined : true,
        OR: query.q
          ? [
              { name: { contains: query.q, mode: "insensitive" } },
              { brand: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    return { products };
  });

  app.post("/products", { preHandler: requireAdmin }, async (request) => {
    const payload = createProductSchema.parse(request.body);

    const product = await app.prisma.product.create({
      data: payload,
    });

    return { product };
  });

  app.patch("/products/:productId", { preHandler: requireAdmin }, async (request) => {
    const { productId } = productParamsSchema.parse(request.params);
    const payload = updateProductSchema.parse(request.body);

    const existing = await app.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound("Товар не найден");
    }

    const product = await app.prisma.product.update({
      where: { id: productId },
      data: payload,
    });

    return { product };
  });

  app.delete("/products/:productId", { preHandler: requireAdmin }, async (request, reply) => {
    const { productId } = productParamsSchema.parse(request.params);

    const existing = await app.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound("Товар не найден");
    }

    await app.prisma.product.delete({
      where: { id: productId },
    });

    return reply.status(204).send();
  });
};

export default adminRoutes;
