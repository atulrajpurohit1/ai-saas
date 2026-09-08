import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Regression for the missing `Guard.refresh_token` column.
 *
 * The `refreshToken String? @map("refresh_token")` field was added to the Guard
 * model in schema.prisma and is read on every guard-portal login, but no
 * migration ever created the column. That made `POST /guard-auth/login` return
 * HTTP 500 (Prisma P2022: "The column `Guard.refresh_token` does not exist")
 * for ALL credentials — a hard outage of the entire guard portal, guard tour,
 * panic button and offline sync.
 *
 * This test talks to the real database. It asserts login NEVER 500s: bad
 * credentials must come back as a clean 401, and a seeded guard must be able to
 * authenticate (which exercises the refresh-token write path too).
 */
describe('GuardAuth (e2e) — refresh_token column regression', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const TAG = `guardauth-e2e-${Date.now()}`;
  let tenantId: string;
  const guardEmail = `${TAG}@guard.test`;
  const guardPassword = 'GuardPass123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const bcrypt = await import('bcrypt');
    const tenant = await prisma.tenant.create({
      data: { name: `GuardAuth E2E ${Date.now()}`, slug: TAG },
    });
    tenantId = tenant.id;
    await prisma.guard.create({
      data: {
        name: 'E2E Guard',
        email: guardEmail,
        phone: `999${Date.now().toString().slice(-7)}`,
        passwordHash: await bcrypt.hash(guardPassword, 10),
        tenantId,
      },
    });
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.guard.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.tenant
        .delete({ where: { id: tenantId } })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('rejects wrong credentials with 401 (never 500)', async () => {
    const res = await request(app.getHttpServer())
      .post('/guard-auth/login')
      .send({ identifier: guardEmail, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown identifier with 401 (never 500)', async () => {
    const res = await request(app.getHttpServer())
      .post('/guard-auth/login')
      .send({
        identifier: `nobody-${TAG}@guard.test`,
        password: 'whatever123',
      });
    expect(res.status).toBe(401);
  });

  it('authenticates a valid guard and issues tokens (exercises the refresh_token write)', async () => {
    const res = await request(app.getHttpServer())
      .post('/guard-auth/login')
      .send({ identifier: guardEmail, password: guardPassword });
    expect(res.status).toBe(200);
    const body = res.body as { access_token?: string; refresh_token?: string };
    expect(body.access_token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();

    // The refresh token hash must have been persisted to the (previously
    // missing) column.
    const guard = await prisma.guard.findFirst({
      where: { email: guardEmail },
    });
    expect(guard?.refreshToken).toBeTruthy();
  });
});
