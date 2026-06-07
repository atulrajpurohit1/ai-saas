import { PartialType } from '@nestjs/mapped-types';
import { CreateSSOProviderDto } from './create-sso-provider.dto';

export class UpdateSSOProviderDto extends PartialType(CreateSSOProviderDto) {}
