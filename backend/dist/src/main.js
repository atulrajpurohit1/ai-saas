"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
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
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 204,
    });
    const port = process.env.PORT || 5000;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}/api`);
}
void bootstrap();
//# sourceMappingURL=main.js.map