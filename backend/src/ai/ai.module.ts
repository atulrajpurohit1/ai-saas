import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiUsageService } from './ai-usage.service';
import { AiUsageController } from './ai-usage.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AiUsageController],
  providers: [AiService, AiUsageService],
  exports: [AiService, AiUsageService],
})
export class AiModule {}
