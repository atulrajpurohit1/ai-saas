import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateGuardComplianceDto } from './create-guard-compliance.dto';

// guard_id is intentionally excluded - a compliance record isn't
// reassignable to a different guard after creation.
export class UpdateGuardComplianceDto extends PartialType(
  OmitType(CreateGuardComplianceDto, ['guard_id'] as const),
) {}
