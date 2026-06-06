"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const prisma_exception_filter_1 = require("./prisma/prisma-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalFilters(new prisma_exception_filter_1.PrismaExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    const configuredOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const allowedOrigins = new Set([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://ai-saas-qd62.vercel.app',
        'https://ai-saas-mxab.vercel.app',
        ...configuredOrigins,
    ]);
    const isAllowedOrigin = (origin) => {
        if (!origin) {
            return true;
        }
        return (allowedOrigins.has(origin) ||
            /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
            /^https:\/\/ai-saas-[a-z0-9-]+\.vercel\.app$/.test(origin));
    };
    app.enableCors({
        origin: (origin, callback) => {
            callback(null, isAllowedOrigin(origin));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-API-Key',
            'X-Ai-Saas-Event',
            'X-Ai-Saas-Delivery-Id',
            'X-Ai-Saas-Timestamp',
            'X-Ai-Saas-Signature',
        ],
        optionsSuccessStatus: 204,
    });
    const port = process.env.PORT || 5000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://localhost:${port}/api`);
}
void bootstrap();
//# sourceMappingURL=main.js.map