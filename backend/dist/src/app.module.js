"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./users/users.module");
const auth_module_1 = require("./auth/auth.module");
const leads_module_1 = require("./leads/leads.module");
const deals_module_1 = require("./deals/deals.module");
const proposals_module_1 = require("./proposals/proposals.module");
const ai_module_1 = require("./ai/ai.module");
const email_module_1 = require("./email/email.module");
const audit_module_1 = require("./audit/audit.module");
const notes_module_1 = require("./notes/notes.module");
const activities_module_1 = require("./activities/activities.module");
const sites_module_1 = require("./sites/sites.module");
const guards_module_1 = require("./guards/guards.module");
const shifts_module_1 = require("./shifts/shifts.module");
const assignments_module_1 = require("./assignments/assignments.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            leads_module_1.LeadsModule,
            deals_module_1.DealsModule,
            proposals_module_1.ProposalsModule,
            ai_module_1.AiModule,
            email_module_1.EmailModule,
            audit_module_1.AuditModule,
            notes_module_1.NotesModule,
            activities_module_1.ActivitiesModule,
            sites_module_1.SitesModule,
            guards_module_1.GuardsModule,
            shifts_module_1.ShiftsModule,
            assignments_module_1.AssignmentsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map