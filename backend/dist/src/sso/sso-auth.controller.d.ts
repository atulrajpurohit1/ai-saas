import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { SSOLoginDto } from './dto/sso-login.dto';
import { SsoService } from './sso.service';
export declare class SsoAuthController {
    private readonly ssoService;
    private readonly configService;
    constructor(ssoService: SsoService, configService: ConfigService);
    login(dto: SSOLoginDto, req: Request): Promise<{
        provider_id: any;
        provider_name: any;
        redirect_url: string;
        saml: boolean;
    } | {
        provider_id: string;
        provider_name: string;
        redirect_url: string;
    }>;
    callback(query: {
        code?: string;
        state?: string;
        json?: string;
    }, req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    private requestContext;
}
