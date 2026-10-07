import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiUsageService } from './ai-usage.service';
import { AiUsageController } from './ai-usage.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AiController, AiUsageController],
  providers: [AiService, AiUsageService],
  exports: [AiService, AiUsageService],
})
export class AiModule {}
