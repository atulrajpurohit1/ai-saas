import { ServiceModule } from '@prisma/client';
export declare const SERVICE_MODULES_KEY = "service_modules";
export declare const RequireModule: (...modules: ServiceModule[]) => import("@nestjs/common").CustomDecorator<string>;
