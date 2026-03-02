import "dotenv/config";

import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function bootstrap() {
  const app = buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: "127.0.0.1",
      listenTextResolver: () => `Server listening on port ${env.PORT}`,
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void bootstrap();
