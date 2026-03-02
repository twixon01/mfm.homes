import { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(request: FastifyRequest) {
  await request.jwtVerify();
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await request.jwtVerify();

  const user = await reply.server.prisma.user.findUnique({
    where: { id: request.user.sub },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    throw reply.server.httpErrors.forbidden("Доступ только для администратора");
  }
}
