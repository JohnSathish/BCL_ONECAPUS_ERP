import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors.config';
import { seedWebsitePublicUploads } from './common/uploads/seed-website-public-uploads';
import {
  resolveStorageRoot,
  resolveUploadRoot,
} from './common/uploads/upload-paths';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
    { rawBody: true },
  );

  // CMS rich text (announcements/notices with inline images as URLs) can exceed
  // Express's default 100kb JSON limit; keep below nginx client_max_body_size.
  app.useBodyParser('json', { limit: '5mb' });
  app.useBodyParser('urlencoded', { limit: '5mb', extended: true });

  seedWebsitePublicUploads();

  // School admission documents must not be world-readable via /uploads (IDOR).
  // Applicant/office UIs use authenticated download endpoints instead.
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    const path = typeof req.path === 'string' ? req.path : '';
    const url = typeof req.url === 'string' ? req.url : '';
    if (
      path.includes('/school-admissions/') ||
      url.includes('/school-admissions/')
    ) {
      res.status(401).type('text/plain').send('Authentication required');
      return;
    }
    next();
  });

  // CMS/hero files may live in UPLOAD_ROOT (/data/uploads) or STORAGE_ROOT
  // (/data/storage). Serve both so a deploy does not blank the homepage slider.
  app.useStaticAssets(resolveUploadRoot(), {
    prefix: '/uploads/',
    maxAge: '7d',
    immutable: true,
  });
  app.useStaticAssets(resolveStorageRoot(), {
    prefix: '/uploads/',
    maxAge: '7d',
    immutable: true,
  });

  app.use(cookieParser());
  // Honor X-Forwarded-* / proxy IPs so rate limits are not keyed to the
  // reverse proxy address for every campus user.
  app.set('trust proxy', 1);

  const config = app.get(ConfigService);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          frameSrc: ["'self'", 'https://api.razorpay.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https://api.razorpay.com'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.enableCors(buildCorsOptions(config));

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('NEP College ERP API')
    .setDescription('SaaS multi-tenant College ERP aligned with NEP-2020')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  const port = Number(config.get('PORT', 3001));
  const host = config.get('API_HOST', config.get('HOST', '127.0.0.1'));
  await app.listen(port, host);
  console.log(`[api] Listening on http://${host}:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('[api] Fatal bootstrap error', err);
  process.exit(1);
});
