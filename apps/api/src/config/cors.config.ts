import type { ConfigService } from '@nestjs/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function buildCorsOptions(config: ConfigService): CorsOptions {
  const webOrigin = config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
  const extraOrigins = (config.get<string>('CORS_EXTRA_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isDev = config.get<string>('NODE_ENV', 'development') !== 'production';

  const productionOrigins = [
    webOrigin,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    ...extraOrigins,
  ];

  return {
    origin: isDev
      ? (origin, callback) => {
          if (!origin) {
            callback(null, true);
            return;
          }
          const localDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
            origin,
          );
          const lanDev =
            /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
              origin,
            );
          if (localDev || lanDev) {
            callback(null, true);
          } else {
            callback(
              null,
              origin === webOrigin || extraOrigins.includes(origin),
            );
          }
        }
      : productionOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Tenant-Slug',
      'X-Forwarded-Host',
      'X-Login-Host',
      'X-Request-Id',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };
}
