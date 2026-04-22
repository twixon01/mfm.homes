import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { env } from "../../config/env.js";
import { requireAdmin } from "../../lib/auth.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  productParamsSchema,
  updateProductSchema,
} from "../products/product.schema.js";
import { invalidateProductsCache } from "../products/product.route.js";
import { changeRoleSchema } from "../users/user.schema.js";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return value;
}, z.boolean());

const adminOrdersQuerySchema = z.object({
  sort: z.enum(["newest", "oldest"]).default("newest"),
  includeCompleted: booleanQuerySchema.default(true),
  includeOpen: booleanQuerySchema.default(true),
});

const COMPLETED_ORDER_STATUSES: Array<"COMPLETED" | "CANCELLED"> = ["COMPLETED", "CANCELLED"];

function resolveUploadsDir() {
  if (env.UPLOADS_DIR) return env.UPLOADS_DIR;
  if (env.NODE_ENV === "production") return "/var/www/mfm/uploads";
  return path.resolve(process.cwd(), "../frontend/public/uploads");
}

function normalizeExtension(filename?: string) {
  if (!filename) return ".bin";
  const ext = path.extname(filename).toLowerCase();
  if (!ext) return ".bin";
  if (ext.length > 10) return ".bin";
  return ext;
}

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
        sourceType: "INTERNAL",
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

  app.get("/orders", { preHandler: requireAdmin }, async (request) => {
    const query = adminOrdersQuerySchema.parse(request.query);

    let statusFilter: { in: Array<"COMPLETED" | "CANCELLED"> } | { notIn: Array<"COMPLETED" | "CANCELLED"> } | undefined;
    if (query.includeCompleted && !query.includeOpen) {
      statusFilter = { in: COMPLETED_ORDER_STATUSES };
    } else if (!query.includeCompleted && query.includeOpen) {
      statusFilter = { notIn: COMPLETED_ORDER_STATUSES };
    } else if (!query.includeCompleted && !query.includeOpen) {
      return { orders: [] };
    }

    const orders = await app.prisma.order.findMany({
      where: {
        status: statusFilter,
      },
      orderBy: {
        createdAt: query.sort === "oldest" ? "asc" : "desc",
      },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return { orders };
  });

  app.post("/products", { preHandler: requireAdmin }, async (request) => {
    const payload = createProductSchema.parse(request.body);

    const product = await app.prisma.product.create({
      data: payload,
    });
    invalidateProductsCache();

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
    invalidateProductsCache();

    return { product };
  });

  app.post("/products/:productId/images", { preHandler: requireAdmin }, async (request) => {
    const { productId } = productParamsSchema.parse(request.params);
    const product = await app.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, images: true },
    });

    if (!product) {
      throw app.httpErrors.notFound("Товар не найден");
    }

    const filePart = await request.file();
    if (!filePart) {
      throw app.httpErrors.badRequest("Файл не передан");
    }

    if (!filePart.mimetype.startsWith("image/")) {
      throw app.httpErrors.badRequest("Можно загружать только изображения");
    }

    const fileBuffer = await filePart.toBuffer();
    if (fileBuffer.length === 0) {
      throw app.httpErrors.badRequest("Пустой файл");
    }

    const ext = normalizeExtension(filePart.filename);
    const safeName = `${Date.now()}-${randomUUID()}${ext}`;
    const uploadsDir = resolveUploadsDir();
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, safeName), fileBuffer);

    const publicPrefix = env.UPLOADS_PUBLIC_PREFIX.startsWith("/") ? env.UPLOADS_PUBLIC_PREFIX : `/${env.UPLOADS_PUBLIC_PREFIX}`;
    const imageUrl = `${publicPrefix}/${safeName}`;

    const nextImages = Array.from(new Set([...(product.images ?? []), imageUrl]));
    const updated = await app.prisma.product.update({
      where: { id: productId },
      data: { images: nextImages },
    });
    invalidateProductsCache();

    return {
      imageUrl,
      product: updated,
    };
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
    invalidateProductsCache();

    return reply.status(204).send();
  });
};

export default adminRoutes;
