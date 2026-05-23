import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GuardAuthController } from './guard-auth.controller';
import { GuardAuthService } from './guard-auth.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [GuardAuthController],
  providers: [GuardAuthService],
})
export class GuardAuthModule {}
