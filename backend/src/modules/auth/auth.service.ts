import bcrypt from "bcryptjs";
import { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";
import { LoginInput, RegisterInput } from "./auth.schema.js";

const SALT_ROUNDS = 12;

function buildAuthResponse(user: { id: string; email: string; role: string }, token: string) {
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

export async function registerUser(app: FastifyInstance, input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw app.httpErrors.conflict("Пользователь с таким email уже существует");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
    },
  });

  const token = await app.jwt.sign(
    { role: user.role, email: user.email },
    { sub: user.id, expiresIn: "7d" },
  );

  return buildAuthResponse(user, token);
}

export async function loginUser(app: FastifyInstance, input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw app.httpErrors.unauthorized("Неверный email или пароль");
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw app.httpErrors.unauthorized("Неверный email или пароль");
  }

  const token = await app.jwt.sign(
    { role: user.role, email: user.email },
    { sub: user.id, expiresIn: "7d" },
  );

  return buildAuthResponse(user, token);
}
