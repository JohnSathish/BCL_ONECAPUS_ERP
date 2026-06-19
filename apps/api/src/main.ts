import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors.config';
import { resolveUploadRoot } from './common/uploads/upload-paths';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
    { rawBody: true },
  );

  app.useStaticAssets(resolveUploadRoot(), {
    prefix: '/uploads/',
    maxAge: '7d',
    immutable: true,
  });

  app.use(cookieParser());

  const config = app.get(ConfigService);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
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
