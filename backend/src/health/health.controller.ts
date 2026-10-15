import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health probes. Deliberately unauthenticated: an uptime monitor and a
 * container orchestrator both need to reach these without a credential, and
 * neither response reveals anything an anonymous caller could not already
 * infer from whether the site loads.
 *
 * There are two of them because they answer different questions, and conflating
 * them causes outages:
 *
 *   /api/health/live  "is this process alive?"  -- no dependencies touched.
 *       This is what Docker's healthcheck uses. If it checked the database,
 *       a brief Postgres restart would mark every backend container unhealthy
 *       and Compose would restart them all, turning a 5-second blip into a
 *       cold-start outage.
 *
 *   /api/health       "can this process actually serve traffic?" -- verifies
 *       the database round-trips. This is what the uptime monitor watches,
 *       because a backend that is up but cannot reach its database is down as
 *       far as any user is concerned, and the bare `GET /api` route would
 *       happily return 200 through exactly that failure.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Never cached: a monitor polling this must see current state, not whatever
  // an intermediary proxy decided to keep.
  @Get('live')
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async ready(@Res({ passthrough: true }) res: Response) {
    const startedAt = Date.now();

    try {
      // Cheapest possible statement that still proves the connection pool can
      // hand out a working connection and the server answers.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      // 503 rather than 500: this is "try again", not "this request was wrong",
      // and it is the status every uptime service treats as an outage.
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'error',
        database: 'unreachable',
        // The driver's message can carry the connection string's host and user,
        // so only the error class name is exposed. The full error is in the logs.
        reason: error instanceof Error ? error.name : 'unknown',
      };
    }

    return {
      status: 'ok',
      database: 'ok',
      databaseLatencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
