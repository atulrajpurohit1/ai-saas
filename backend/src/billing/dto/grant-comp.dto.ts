import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { COMP_PLAN_KEYS, CompPlanKey } from '../comp-plan.constants';

/**
 * Grants a tenant a plan for free.
 *
 * Deliberately takes a plan rather than a module list: a comp should be one of
 * the same things the product already knows about, so comped and paying tenants
 * exercise identical entitlement states. The choices are the four sellable
 * packages plus the comp-only "AegisLead Trial Plan", which grants every module
 * but withholds the AI features. A bespoke module mix would be a plan nothing
 * else in the product understands.
 */
export class GrantCompDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tenantId: string;

  @IsIn(COMP_PLAN_KEYS, { message: 'Unknown plan selected.' })
  package: CompPlanKey;

  /**
   * How long the comp lasts. Omit for open-ended access.
   *
   * There is no server-side default on purpose. A silent default would revoke
   * someone's access on a date nobody chose, and discovering that through a
   * locked-out customer is the worst way to find out. The caller states the
   * term; the admin UI pre-fills 90 days so the easy path is still a bounded
   * one.
   */
  @IsOptional()
  @IsInt({ message: 'Duration must be a whole number of days.' })
  @Min(1)
  @Max(3650)
  expiresInDays?: number;

  /** Why this tenant is getting it free. Required: a comp with no stated
   *  reason is unanswerable six months later. */
  @IsString()
  @MinLength(3, { message: 'Give a reason for the complimentary access.' })
  @MaxLength(500)
  reason: string;
}
