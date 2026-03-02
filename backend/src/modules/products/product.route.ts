import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";

import { listProductsQuerySchema, productParamsSchema } from "./product.schema.js";

const productRoutes: FastifyPluginAsync = async (app) => {
  app.get("/products", async (request) => {
    const query = listProductsQuerySchema.parse(request.query);

    const where: Prisma.ProductWhereInput = {
      isActive: query.includeInactive ? undefined : true,
      category: query.category,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: "insensitive" } },
            { brand: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
          ]
        : undefined,
    };

    const products = await app.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { products };
  });

  app.get("/products/:productId", async (request) => {
    const { productId } = productParamsSchema.parse(request.params);

    const product = await app.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
    });

    if (!product) {
      throw app.httpErrors.notFound("Товар не найден");
    }

    return { product };
  });
};

export default productRoutes;
