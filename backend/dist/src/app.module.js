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
const clients_module_1 = require("./clients/clients.module");
const client_auth_module_1 = require("./client-auth/client-auth.module");
const client_portal_module_1 = require("./client-portal/client-portal.module");
const documents_module_1 = require("./documents/documents.module");
const guard_auth_module_1 = require("./guard-auth/guard-auth.module");
const guard_portal_module_1 = require("./guard-portal/guard-portal.module");
const incidents_module_1 = require("./incidents/incidents.module");
const reports_module_1 = require("./reports/reports.module");
const invoices_module_1 = require("./invoices/invoices.module");
const invoice_disputes_module_1 = require("./invoice-disputes/invoice-disputes.module");
const finance_module_1 = require("./finance/finance.module");
const timesheets_module_1 = require("./timesheets/timesheets.module");
const rate_cards_module_1 = require("./rate-cards/rate-cards.module");
const ai_insights_module_1 = require("./ai-insights/ai-insights.module");
const ai_actions_module_1 = require("./ai-actions/ai-actions.module");
const ai_monitoring_module_1 = require("./ai-monitoring/ai-monitoring.module");
const ai_governance_module_1 = require("./ai-governance/ai-governance.module");
const knowledge_base_module_1 = require("./knowledge-base/knowledge-base.module");
const ai_copilot_module_1 = require("./ai-copilot/ai-copilot.module");
const ai_predictions_module_1 = require("./ai-predictions/ai-predictions.module");
const branches_module_1 = require("./branches/branches.module");
const roles_module_1 = require("./roles/roles.module");
const api_keys_module_1 = require("./api-keys/api-keys.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const public_api_module_1 = require("./public-api/public-api.module");
const integrations_module_1 = require("./integrations/integrations.module");
const crm_connectors_module_1 = require("./crm-connectors/crm-connectors.module");
const call_transcription_module_1 = require("./call-transcription/call-transcription.module");
const api_docs_module_1 = require("./api-docs/api-docs.module");
const sessions_module_1 = require("./sessions/sessions.module");
const sso_module_1 = require("./sso/sso.module");
const branding_module_1 = require("./branding/branding.module");
const billing_module_1 = require("./billing/billing.module");
const sales_accelerator_module_1 = require("./sales-accelerator/sales-accelerator.module");
const sales_automation_module_1 = require("./sales-automation/sales-automation.module");
const sales_delivery_module_1 = require("./sales-delivery/sales-delivery.module");
const sales_imports_module_1 = require("./sales-imports/sales-imports.module");
const patrols_module_1 = require("./patrols/patrols.module");
const field_permissions_module_1 = require("./field-permissions/field-permissions.module");
const prospect_search_module_1 = require("./prospect-search/prospect-search.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            roles_module_1.RolesModule,
            field_permissions_module_1.FieldPermissionsModule,
            api_keys_module_1.ApiKeysModule,
            webhooks_module_1.WebhooksModule,
            public_api_module_1.PublicApiModule,
            integrations_module_1.IntegrationsModule,
            crm_connectors_module_1.CrmConnectorsModule,
            call_transcription_module_1.CallTranscriptionModule,
            api_docs_module_1.ApiDocsModule,
            sessions_module_1.SessionsModule,
            sso_module_1.SsoModule,
            branding_module_1.BrandingModule,
            billing_module_1.BillingModule,
            sales_accelerator_module_1.SalesAcceleratorModule,
            sales_automation_module_1.SalesAutomationModule,
            sales_delivery_module_1.SalesDeliveryModule,
            sales_imports_module_1.SalesImportsModule,
            prospect_search_module_1.ProspectSearchModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            client_auth_module_1.ClientAuthModule,
            client_portal_module_1.ClientPortalModule,
            guard_auth_module_1.GuardAuthModule,
            guard_portal_module_1.GuardPortalModule,
            branches_module_1.BranchesModule,
            incidents_module_1.IncidentsModule,
            reports_module_1.ReportsModule,
            invoices_module_1.InvoicesModule,
            invoice_disputes_module_1.InvoiceDisputesModule,
            finance_module_1.FinanceModule,
            ai_insights_module_1.AiInsightsModule,
            ai_actions_module_1.AiActionsModule,
            ai_governance_module_1.AiGovernanceModule,
            ai_monitoring_module_1.AiMonitoringModule,
            knowledge_base_module_1.KnowledgeBaseModule,
            ai_copilot_module_1.AiCopilotModule,
            ai_predictions_module_1.AiPredictionsModule,
            timesheets_module_1.TimesheetsModule,
            rate_cards_module_1.RateCardsModule,
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
            clients_module_1.ClientsModule,
            documents_module_1.DocumentsModule,
            patrols_module_1.PatrolsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map