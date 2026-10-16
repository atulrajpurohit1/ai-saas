import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true },
    });
  }

  /**
   * Takes a raw Prisma input, so the caller decides every field. isSuperAdmin
   * is pinned to false unless the caller asks for it: this method is reachable
   * from anywhere, and the schema default used to be true, which meant a
   * caller that simply omitted the flag created a full tenant super admin.
   * Being explicit here keeps that from coming back if the column default is
   * ever changed again.
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data: { isSuperAdmin: false, ...data },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
