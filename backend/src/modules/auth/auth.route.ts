import { FastifyPluginAsync } from "fastify";

import { loginSchema, registerSchema } from "./auth.schema.js";
import { loginUser, registerUser } from "./auth.service.js";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request) => {
    const payload = registerSchema.parse(request.body);
    return registerUser(app, payload);
  });

  app.post("/login", async (request) => {
    const payload = loginSchema.parse(request.body);
    return loginUser(app, payload);
  });

  app.get("/me", async (request) => {
    await request.jwtVerify();

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
