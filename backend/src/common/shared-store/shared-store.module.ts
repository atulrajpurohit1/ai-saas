import { Global, Module } from '@nestjs/common';
import { SharedStoreService } from './shared-store.service';

/**
 * Global so the single Redis connection is shared by every consumer rather
 * than one socket per importing module.
 */
@Global()
@Module({
  providers: [SharedStoreService],
  exports: [SharedStoreService],
})
export class SharedStoreModule {}
