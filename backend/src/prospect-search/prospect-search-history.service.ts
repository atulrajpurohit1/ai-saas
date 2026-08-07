import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class ProspectSearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    tenantId: string;
    userId: string;
    prompt: string;
    provider: string;
    resultCount: number;
  }) {
    return this.prisma.prospectSearchHistory.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        prompt: input.prompt,
        filters: {},
        provider: input.provider,
        resultCount: input.resultCount,
      },
    });
  }

  async list(tenantId: string, userId: string, limit?: number) {
    const take = Math.min(
      Math.max(limit && Number.isFinite(limit) ? limit : DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    return this.prisma.prospectSearchHistory.findMany({
      where: { tenantId, userId },
      orderBy: { searchedAt: 'desc' },
      take,
    });
  }
}
