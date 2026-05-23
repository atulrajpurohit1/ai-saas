import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const shifts = await this.prisma.shift.findMany({
      where: { tenantId },
      select: { id: true },
    });

    if (shifts.length === 0) {
      return [];
    }

    return this.prisma.assignment.findMany({
      where: {
        shiftId: {
          in: shifts.map((shift) => shift.id),
        },
      },
      include: {
        shift: {
          include: {
            site: true,
          },
        },
        guard: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
