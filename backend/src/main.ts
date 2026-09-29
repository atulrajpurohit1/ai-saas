import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';
import { setDefaultResultOrder } from 'dns';
import type { Request, Response, NextFunction } from 'express';
import { assertEnvironment } from './config/environment-check';

// Prefer IPv4 for all outbound DNS lookups, process-wide. Some
// hosting/sandboxed networks resolve a hostname (e.g. the SMTP provider) to
// an IPv6 (or NAT64-synthesized) address that is unreachable or very slow,
// and Node's default dual-stack connect attempt eats a long IPv6 timeout
// before falling back to IPv4 — turning what should be a sub-second
// outbound connection into a 15-20s stall on the request path (e.g. every
// OTP email send). This only changes lookup preference, never correctness,
// for any outbound call this process makes.
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  // Before anything connects or listens: a deploy missing its secrets should
  // fail here with the name of what is missing, not on the first request.
  assertEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Stripe signs the exact bytes it sent, so signature verification needs the
    // unparsed body. This keeps the parsed body available everywhere else and
    // exposes req.rawBody alongside it, used only by the Stripe webhook route.
    rawBody: true,
  });

  // Default body-parser limit (100kb) is too small for base64 logo uploads on RFPs/branding.
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  app.useGlobalFilters(new PrismaExceptionFilter());
  // `whitelist: true` already strips any property the DTO does not declare,
  // which is what prevents mass assignment. `forbidNonWhitelisted` was
  // deliberately NOT added: it would turn every request carrying a stray field
  // into a 400, which is a breaking change for existing clients without
  // closing any hole that whitelist leaves open.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // Baseline security response headers. Written by hand rather than pulled in
  // via helmet so this needs no new dependency; the set below is the subset of
  // helmet's defaults that is meaningful for a JSON API with no server-rendered
  // HTML. Revisit if this process ever serves a browser-facing document.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    // Stop browsers from MIME-sniffing a JSON response into something else.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // No API response should ever be framed.
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    // Do not leak API paths (which contain ids) to third-party sites.
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Cross-origin responses are governed by the CORS config below; this stops
    // other origins embedding responses as a resource.
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.removeHeader('X-Powered-By');

    // HSTS only makes sense once traffic is actually HTTPS, and setting it in
    // local development would pin localhost to https in the developer's
    // browser for a year.
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  const configuredOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://ai-saas-qd62.vercel.app',
    'https://ai-saas-mxab.vercel.app',
    'https://www.aegislead.co',
    'https://aegislead.co',
    // The live dashboard. Listed here as well as in CORS_ORIGINS so the app
    // keeps working if that env var is lost in a redeploy or a new environment.
    'https://dashboard.aegislead.co',
    ...configuredOrigins,
  ]);

  // `ai-saas-*.vercel.app` is a wildcard over a namespace WE DO NOT CONTROL:
  // anyone can create a Vercel project called `ai-saas-<anything>` and get a
  // matching origin, which this rule would then trust with credentials. It is
  // genuinely useful for preview deploys, so it stays available outside
  // production and can be re-enabled explicitly if a production preview URL is
  // ever needed -- but it is no longer on by default where it matters.
  const allowVercelPreviews =
    process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true' ||
    process.env.NODE_ENV !== 'production';

  const isAllowedOrigin = (origin?: string) => {
    // No Origin header: a non-browser caller (curl, server-to-server, health
    // check). CORS is a browser mechanism and cannot protect these anyway --
    // they are authenticated by the Authorization header like any other client.
    if (!origin) {
      return true;
    }

    if (allowedOrigins.has(origin)) return true;

    // Localhost is a developer convenience and has no place in production,
    // where it only widens what an attacker-controlled page can reach.
    if (
      process.env.NODE_ENV !== 'production' &&
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    ) {
      return true;
    }

    return (
      allowVercelPreviews &&
      /^https:\/\/ai-saas-[a-z0-9-]+\.vercel\.app$/.test(origin)
    );
  };

  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Ai-Saas-Event',
      'X-Ai-Saas-Delivery-Id',
      'X-Ai-Saas-Timestamp',
      'X-Ai-Saas-Signature',
    ],
    optionsSuccessStatus: 204,
  });

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}/api`);
}
void bootstrap();
