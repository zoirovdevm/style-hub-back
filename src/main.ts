import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  mkdirSync(join(process.cwd(), 'uploads', 'products'), { recursive: true });
  mkdirSync(join(process.cwd(), 'uploads', 'reviews'), { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });

  // Nginx sits in front of this app as a reverse proxy (see DEPLOY.md), so
  // every request Express sees actually comes from 127.0.0.1 (or the
  // Docker gateway) — without this, `req.ip` always resolves to that same
  // proxy address for EVERY visitor, which collapses the per-IP rate
  // limiter (ThrottlerModule, see app.module.ts) into one single SHARED
  // bucket for the entire site's traffic instead of one bucket per real
  // visitor. `1` means "trust exactly one hop in front of us" (the nginx
  // reverse proxy) — Express then reads the real client IP from
  // X-Forwarded-For (which nginx must set; see the /graphql etc. location
  // blocks in DEPLOY.md's nginx config) instead of the immediate TCP peer.
  app.set('trust proxy', 1);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Fashion Marketplace API ready at http://localhost:${port}/graphql`);
}

bootstrap();
