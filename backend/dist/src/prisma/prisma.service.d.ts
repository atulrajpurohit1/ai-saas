import { OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
export declare class PrismaService extends PrismaClient implements OnModuleInit {
    private configService;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
}
