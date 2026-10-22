import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteTenantDto {
  /**
   * The tenant's exact name, echoed back by the caller. Checked server-side
   * (see TenantAdminService.deleteTenant) so that the confirmation cannot be
   * bypassed by calling the endpoint directly.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  confirmName: string;
}
