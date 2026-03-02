import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { requireAuth } from "../../lib/auth.js";
import { changePasswordSchema, upsertAddressSchema, updateProfileSchema } from "./user.schema.js";

const paramsSchema = z.object({
  addressId: z.string().min(1),
});

const SALT_ROUNDS = 12;

const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me/profile", { preHandler: requireAuth }, async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw app.httpErrors.notFound("Пользователь не найден");
    }

    return { user };
  });

  app.patch("/me/profile", { preHandler: requireAuth }, async (request) => {
    const payload = updateProfileSchema.parse(request.body);

    const user = await app.prisma.user.update({
      where: { id: request.user.sub },
      data: payload,
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        updatedAt: true,
      },
    });

    return { user };
  });

  app.patch("/me/password", { preHandler: requireAuth }, async (request) => {
    const payload = changePasswordSchema.parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw app.httpErrors.notFound("Пользователь не найден");
    }

    const isCurrentPasswordValid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw app.httpErrors.unauthorized("Текущий пароль неверный");
    }

    const newPasswordHash = await bcrypt.hash(payload.newPassword, SALT_ROUNDS);

    await app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true };
  });

  app.get("/me/addresses", { preHandler: requireAuth }, async (request) => {
    const addresses = await app.prisma.address.findMany({
      where: { userId: request.user.sub },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return { addresses };
  });

  app.post("/me/addresses", { preHandler: requireAuth }, async (request) => {
    const payload = upsertAddressSchema.parse(request.body);

    const created = await app.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.address.updateMany({
          where: { userId: request.user.sub, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId: request.user.sub,
          ...payload,
        },
      });
    });

    return { address: created };
  });

  app.patch("/me/addresses/:addressId", { preHandler: requireAuth }, async (request) => {
    const { addressId } = paramsSchema.parse(request.params);
    const payload = upsertAddressSchema.partial().parse(request.body);

    const existing = await app.prisma.address.findFirst({
      where: { id: addressId, userId: request.user.sub },
    });

    if (!existing) {
      throw app.httpErrors.notFound("Адрес не найден");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.address.updateMany({
          where: { userId: request.user.sub, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: payload,
      });
    });

    return { address: updated };
  });

  app.delete("/me/addresses/:addressId", { preHandler: requireAuth }, async (request, reply) => {
    const { addressId } = paramsSchema.parse(request.params);

    const existing = await app.prisma.address.findFirst({
      where: { id: addressId, userId: request.user.sub },
    });

    if (!existing) {
      throw app.httpErrors.notFound("Адрес не найден");
    }

    await app.prisma.address.delete({ where: { id: addressId } });
    return reply.status(204).send();
  });
};

export default userRoutes;
