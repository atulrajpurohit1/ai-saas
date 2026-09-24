import { ServiceModule } from '@prisma/client';
export declare class CreateCheckoutSessionDto {
    modules: ServiceModule[];
    interval?: 'monthly' | 'annual';
}
