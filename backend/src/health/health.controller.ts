import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Deploy and uptime probes. Deliberately unauthenticated: the platform health
 * check, the reverse proxy and the uptime monitor all call these without
 * credentials, and nothing here reveals anything a caller could not learn by
 * watching the service be up or down.
 *
 * Two endpoints, because they answer different questions:
 *
 *   GET /api/health        Is this process alive? Never touches the database,
 *                          so a database blip does not make a healthy process
 *                          look dead and get restarted.
 *   GET /api/health/ready  Can this process serve a real request? Checks the
 *                          database, and returns 503 when it cannot, which is
 *                          what a deploy script should gate on.
 *
 * Responses are explicitly uncacheable: a cached 200 from a proxy or CDN would
 * make a dead instance look alive for as long as the cache lives.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  liveness() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async readiness() {
    const database = await this.checkDatabase();
    const body = {
      status: database.ok ? 'ok' : 'unavailable',
      database,
      timestamp: new Date().toISOString(),
    };

    // 503, not a 200 carrying bad news: every caller that matters (deploy
    // gate, proxy, uptime monitor) reads the status code, not the body.
    if (!database.ok) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  /**
   * A readiness probe that hangs is worse than one that fails: the deploy
   * script waits out its whole timeout and the proxy holds the connection
   * open. Prisma's own connection timeout is far longer than anything a probe
   * should wait for, so this races it against a short deadline of its own.
   */
  private async checkDatabase(): Promise<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('database check timed out after 3000ms')),
            3000,
          );
        }),
      ]);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Without this the pending timer keeps the event loop (and `jest`) alive
      // for its full duration after a fast success.
      if (timer) clearTimeout(timer);
    }
  }
}
