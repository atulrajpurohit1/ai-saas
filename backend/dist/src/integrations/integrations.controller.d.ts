import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { IntegrationsService } from './integrations.service';
export declare class IntegrationsController {
    private readonly integrationsService;
    constructor(integrationsService: IntegrationsService);
    getOverview(user: ActiveUser): Promise<{
        active_integrations: {
            type: string;
            label: string;
            active: number;
        }[];
        api_usage: {
            requests_last_24h: number;
        };
        webhook_status: {
            id: string;
            event_type: string;
            endpoint_url: string;
            status: string;
            success_count: number;
            failure_count: number;
            latest_delivery_at: Date;
        }[];
        delivery_logs: {
            id: string;
            webhook_id: string;
            event_type: string;
            endpoint_url: string;
            success: boolean;
            response_status: number | null;
            retry_count: number;
            last_error: string | null;
            created_at: Date;
        }[];
        request_logs: {
            id: string;
            api_key_id: string;
            api_key_name: string;
            key_prefix: string;
            endpoint: string;
            method: string;
            status_code: number;
            ip_address: string | null;
            user_agent: string | null;
            created_at: Date;
        }[];
        failures_last_24h: number;
    }>;
}
