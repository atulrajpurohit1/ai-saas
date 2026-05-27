import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateRateCardDto } from './dto/update-rate-card.dto';
import { RateCardsService } from './rate-cards.service';
export declare class RateCardsController {
    private readonly rateCardsService;
    constructor(rateCardsService: RateCardsService);
    create(user: ActiveUser, dto: CreateRateCardDto): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    findAll(user: ActiveUser, status?: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }[]>;
    findOne(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateRateCardDto): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    deactivate(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        roleName: any;
        hourlyRate: any;
        overtimeRate: any;
        holidayRate: any;
        effectiveFrom: any;
        effectiveTo: any;
        status: any;
        createdAt: any;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
}
