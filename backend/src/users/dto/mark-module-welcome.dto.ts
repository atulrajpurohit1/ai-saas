import { IsIn } from 'class-validator';
import { ServiceModule } from '@prisma/client';

const SERVICE_MODULES: ServiceModule[] = ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'];

export class MarkModuleWelcomeDto {
  /**
   * Validated against the enum rather than taken as free text: the value is
   * written into a Postgres enum array, so an unknown string would fail at the
   * database with a 500 instead of a 400, and a typo'd-but-accepted value
   * would suppress that welcome for the user forever.
   */
  @IsIn(SERVICE_MODULES, {
    message: `module must be one of: ${SERVICE_MODULES.join(', ')}`,
  })
  module!: ServiceModule;
}
