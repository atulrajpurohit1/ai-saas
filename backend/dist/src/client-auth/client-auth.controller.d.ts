import { ClientAuthService } from './client-auth.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientRegisterDto } from './client-auth.service';
export declare class ClientAuthController {
    private readonly clientAuthService;
    constructor(clientAuthService: ClientAuthService);
    login(dto: ClientLoginDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    register(dto: ClientRegisterDto): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(userId: string): Promise<boolean>;
}
