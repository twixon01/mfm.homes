import type { FastifyPluginAsync } from "fastify";

import { requireAuth } from "../../lib/auth";
import { addWishlistItemSchema, wishlistProductParamsSchema } from "./wishlist.schema";

const wishlistRoutes: FastifyPluginAsync = async (app) => {
  app.get("/wishlist", { preHandler: requireAuth }, async (request) => {
    const items = await app.prisma.wishlistItem.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        product: true,
      },
    });

    const wishlist = items
      .filter((item) => item.product && item.product.isActive)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        product: item.product,
      }));

    return {
      wishlist,
    };
  });

  app.post("/wishlist", { preHandler: requireAuth }, async (request, reply) => {
    const { productId } = addWishlistItemSchema.parse(request.body);

    const product = await app.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!product) {
      throw app.httpErrors.notFound("Товар не найден");
    }

    await app.prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId: request.user.sub,
          productId,
        },
      },
      update: {},
      create: {
        userId: request.user.sub,
        productId,
      },
    });

    return reply.code(201).send({ success: true });
  });

  app.delete("/wishlist/:productId", { preHandler: requireAuth }, async (request) => {
    const { productId } = wishlistProductParamsSchema.parse(request.params);

    await app.prisma.wishlistItem.deleteMany({
      where: {
        userId: request.user.sub,
        productId,
      },
    });

    return { success: true };
  });
};

export default wishlistRoutes;
