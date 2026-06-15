import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { DealsModule } from './deals/deals.module';
import { ProposalsModule } from './proposals/proposals.module';
import { AiModule } from './ai/ai.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { NotesModule } from './notes/notes.module';
import { ActivitiesModule } from './activities/activities.module';
import { SitesModule } from './sites/sites.module';
import { GuardsModule } from './guards/guards.module';
import { ShiftsModule } from './shifts/shifts.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { ClientsModule } from './clients/clients.module';
import { ClientAuthModule } from './client-auth/client-auth.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { DocumentsModule } from './documents/documents.module';
import { GuardAuthModule } from './guard-auth/guard-auth.module';
import { GuardPortalModule } from './guard-portal/guard-portal.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ReportsModule } from './reports/reports.module';
import { InvoicesModule } from './invoices/invoices.module';
import { InvoiceDisputesModule } from './invoice-disputes/invoice-disputes.module';
import { FinanceModule } from './finance/finance.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { RateCardsModule } from './rate-cards/rate-cards.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { AiActionsModule } from './ai-actions/ai-actions.module';
import { AiMonitoringModule } from './ai-monitoring/ai-monitoring.module';
import { AiGovernanceModule } from './ai-governance/ai-governance.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { AiCopilotModule } from './ai-copilot/ai-copilot.module';
import { AiPredictionsModule } from './ai-predictions/ai-predictions.module';
import { BranchesModule } from './branches/branches.module';
import { RolesModule } from './roles/roles.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PublicApiModule } from './public-api/public-api.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ApiDocsModule } from './api-docs/api-docs.module';
import { SessionsModule } from './sessions/sessions.module';
import { SsoModule } from './sso/sso.module';
import { BrandingModule } from './branding/branding.module';
import { SalesAcceleratorModule } from './sales-accelerator/sales-accelerator.module';
import { SalesImportsModule } from './sales-imports/sales-imports.module';
import { PatrolsModule } from './patrols/patrols.module';
import { FieldPermissionsModule } from './field-permissions/field-permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RolesModule,
    FieldPermissionsModule,
    ApiKeysModule,
    WebhooksModule,
    PublicApiModule,
    IntegrationsModule,
    ApiDocsModule,
    SessionsModule,
    SsoModule,
    BrandingModule,
    SalesAcceleratorModule,
    SalesImportsModule,
    UsersModule,
    AuthModule,
    ClientAuthModule,
    ClientPortalModule,
    GuardAuthModule,
    GuardPortalModule,
    BranchesModule,
    IncidentsModule,
    ReportsModule,
    InvoicesModule,
    InvoiceDisputesModule,
    FinanceModule,
    AiInsightsModule,
    AiActionsModule,
    AiGovernanceModule,
    AiMonitoringModule,
    KnowledgeBaseModule,
    AiCopilotModule,
    AiPredictionsModule,
    TimesheetsModule,
    RateCardsModule,
    LeadsModule,
    DealsModule,
    ProposalsModule,
    AiModule,
    EmailModule,
    AuditModule,
    NotesModule,
    ActivitiesModule,
    SitesModule,
    GuardsModule,
    ShiftsModule,
    AssignmentsModule,
    ClientsModule,
    DocumentsModule,
    PatrolsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
