import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateClientInsurancePolicyDto } from './create-client-insurance-policy.dto';

// client_id is intentionally excluded - a policy isn't reassignable to a
// different client after creation. site_id remains editable (a policy can be
// promoted from site-specific to client-wide or vice versa); it is
// re-validated against the owning client on update.
export class UpdateClientInsurancePolicyDto extends PartialType(
  OmitType(CreateClientInsurancePolicyDto, ['client_id'] as const),
) {}
