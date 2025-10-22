// backend/src/main.ts
import "reflect-metadata"; // must be first
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import { WsAdapter } from "@nestjs/platform-ws";
import { ValidationPipe, INestApplication } from "@nestjs/common";

/**
 * Conditional Swagger setup:
 * - If @nestjs/swagger (+ swagger-ui-express) are installed, mounts docs at /docs
 * - If not installed, quietly no-ops (no TS errors, no runtime crash)
 */
async function maybeSetupSwagger(app: INestApplication) {
  try {
    // Runtime import so TypeScript doesn't need the types installed
    const { SwaggerModule, DocumentBuilder } = require("@nestjs/swagger");

    const config = new DocumentBuilder()
      .setTitle("RemoteIQ API")
      .setDescription("OpenAPI for RemoteIQ RMM")
      .setVersion("v1")
      .addBearerAuth(
        { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        "bearer"
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("/docs", app, document);
    // eslint-disable-next-line no-console
    console.log("Swagger docs mounted at /docs");
  } catch {
    // eslint-disable-next-line no-console
    console.log("Swagger not installed. Skipping docs (pnpm add -D @nestjs/swagger swagger-ui-express)");
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.enableCors();
  app.useWebSocketAdapter(new WsAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.enableShutdownHooks();

  // simple health check
  app.getHttpAdapter().getInstance().get("/healthz", (_req: any, res: any) => res.send("OK"));

  // Swagger (safe no-op if deps are missing)
  await maybeSetupSwagger(app);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API up on http://localhost:${port}`);
}
bootstrap();
