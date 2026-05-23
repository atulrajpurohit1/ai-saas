import { GuardLoginDto } from './dto/guard-login.dto';
import { GuardAuthService } from './guard-auth.service';
export declare class GuardAuthController {
    private readonly guardAuthService;
    constructor(guardAuthService: GuardAuthService);
    login(dto: GuardLoginDto): Promise<{
        access_token: string;
        guard: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
            tenantId: string;
            tenantName: string;
        };
    }>;
}
