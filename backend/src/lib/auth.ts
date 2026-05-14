import { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

export const AUTH_COOKIE_NAME = "mfm_auth";
const AUTH_COOKIE_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function requireAuth(request: FastifyRequest) {
  await request.jwtVerify({ onlyCookie: true });
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await request.jwtVerify({ onlyCookie: true });

  const user = await reply.server.prisma.user.findUnique({
    where: { id: request.user.sub },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    throw reply.server.httpErrors.forbidden("Доступ только для администратора");
  }
}

export function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(AUTH_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: AUTH_COOKIE_TTL_SECONDS,
  });
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(AUTH_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}
