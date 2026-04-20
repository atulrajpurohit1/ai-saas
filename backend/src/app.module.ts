import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { DealsModule } from './deals/deals.module';
import { ProposalsModule } from './proposals/proposals.module';
import { AiModule } from './ai/ai.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    LeadsModule,
    DealsModule,
    ProposalsModule,
    AiModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
