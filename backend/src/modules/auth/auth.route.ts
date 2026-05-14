import { FastifyPluginAsync } from "fastify";

import { clearAuthCookie, requireAuth, setAuthCookie } from "../../lib/auth.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { loginUser, registerUser } from "./auth.service.js";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const payload = registerSchema.parse(request.body);
    const session = await registerUser(app, payload);
    setAuthCookie(reply, session.token);
    return { user: session.user };
  });

  app.post("/login", async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const session = await loginUser(app, payload);
    setAuthCookie(reply, session.token);
    return { user: session.user };
  });

  app.post("/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return reply.status(204).send();
  });

  app.get("/me", async (request) => {
    await requireAuth(request);

    const userId = request.user.sub;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw app.httpErrors.notFound("Пользователь не найден");
    }

    return { user };
  });
};

export default authRoutes;
