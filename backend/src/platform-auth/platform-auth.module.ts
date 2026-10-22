import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { JwtPlatformStrategy } from './strategies/jwt-platform.strategy';
import { JwtPlatformRefreshStrategy } from './strategies/jwt-platform-refresh.strategy';

/**
 * Authentication for the platform console, kept entirely separate from
 * AuthModule.
 *
 * Nothing is exported except the service, and AuthModule is deliberately NOT
 * imported: the two login systems share no provider, no strategy and no
 * signing secret, so there is no code path by which a tenant login could come
 * to issue a platform token.
 */
@Module({
  imports: [PrismaModule, ConfigModule, JwtModule.register({})],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    JwtPlatformStrategy,
    JwtPlatformRefreshStrategy,
  ],
  exports: [PlatformAuthService],
})
export class PlatformAuthModule {}
