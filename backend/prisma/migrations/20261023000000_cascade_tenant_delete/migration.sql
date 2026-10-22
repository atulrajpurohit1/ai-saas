-- Make tenant deletion actually cascade, which the delete-tenant code already
-- assumes ("cascades to every table that references it") but the schema never
-- enforced: 30 of the tenant own child FKs were RESTRICT, so deleting a
-- tenant that had even one user threw a foreign-key error and surfaced as a
-- 500 in the super-admin panel.
--
-- This converts the RESTRICT / NO ACTION foreign keys along the tenant
-- ownership tree to ON DELETE CASCADE, for every table transitively owned by a
-- tenant (users, clients, sites, guards, shifts, invoices, incidents and their
-- children). ON UPDATE is left as it was.
--
-- SET NULL foreign keys are deliberately NOT touched: those are optional
-- cross-references (e.g. Activity.dealId -> Deal), where deleting one parent
-- should null the reference, not delete the referencing row. The referencing
-- row is itself tenant-owned and is removed by its own tenant cascade, so the
-- tenant delete still completes.

ALTER TABLE "Activity" DROP CONSTRAINT "Activity_tenantId_fkey";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AiConversation" DROP CONSTRAINT "AiConversation_tenant_id_fkey";
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AiFeedback" DROP CONSTRAINT "AiFeedback_tenant_id_fkey";
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AiGeneration" DROP CONSTRAINT "AiGeneration_tenant_id_fkey";
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_guardId_fkey";
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_shiftId_fkey";
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AttendanceEvent" DROP CONSTRAINT "AttendanceEvent_guardId_fkey";
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AttendanceEvent" DROP CONSTRAINT "AttendanceEvent_shiftId_fkey";
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AttendanceEvent" DROP CONSTRAINT "AttendanceEvent_tenantId_fkey";
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_tenantId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_guardId_fkey";
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_tenantId_fkey";
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_tenant_id_fkey";
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Client" DROP CONSTRAINT "Client_tenantId_fkey";
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ClientUser" DROP CONSTRAINT "ClientUser_clientId_fkey";
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ClientUser" DROP CONSTRAINT "ClientUser_tenantId_fkey";
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "DailyServiceReport" DROP CONSTRAINT "DailyServiceReport_client_id_fkey";
ALTER TABLE "DailyServiceReport" ADD CONSTRAINT "DailyServiceReport_client_id_fkey" FOREIGN KEY (client_id) REFERENCES "Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "DailyServiceReport" DROP CONSTRAINT "DailyServiceReport_site_id_fkey";
ALTER TABLE "DailyServiceReport" ADD CONSTRAINT "DailyServiceReport_site_id_fkey" FOREIGN KEY (site_id) REFERENCES "Site"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "DailyServiceReport" DROP CONSTRAINT "DailyServiceReport_tenant_id_fkey";
ALTER TABLE "DailyServiceReport" ADD CONSTRAINT "DailyServiceReport_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_leadId_fkey";
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_tenantId_fkey";
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Guard" DROP CONSTRAINT "Guard_tenantId_fkey";
ALTER TABLE "Guard" ADD CONSTRAINT "Guard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "GuardSyncQueue" DROP CONSTRAINT "GuardSyncQueue_guard_id_fkey";
ALTER TABLE "GuardSyncQueue" ADD CONSTRAINT "GuardSyncQueue_guard_id_fkey" FOREIGN KEY (guard_id) REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "GuardSyncQueue" DROP CONSTRAINT "GuardSyncQueue_tenant_id_fkey";
ALTER TABLE "GuardSyncQueue" ADD CONSTRAINT "GuardSyncQueue_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_guard_id_fkey";
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_guard_id_fkey" FOREIGN KEY (guard_id) REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_shift_id_fkey";
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES "Shift"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_site_id_fkey";
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_site_id_fkey" FOREIGN KEY (site_id) REFERENCES "Site"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_tenant_id_fkey";
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_client_id_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_client_id_fkey" FOREIGN KEY (client_id) REFERENCES "Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_site_id_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_site_id_fkey" FOREIGN KEY (site_id) REFERENCES "Site"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_tenant_id_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "InvoiceDispute" DROP CONSTRAINT "InvoiceDispute_client_id_fkey";
ALTER TABLE "InvoiceDispute" ADD CONSTRAINT "InvoiceDispute_client_id_fkey" FOREIGN KEY (client_id) REFERENCES "Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "InvoiceDispute" DROP CONSTRAINT "InvoiceDispute_tenant_id_fkey";
ALTER TABLE "InvoiceDispute" ADD CONSTRAINT "InvoiceDispute_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_guard_id_fkey";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_guard_id_fkey" FOREIGN KEY (guard_id) REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_shift_id_fkey";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES "Shift"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_tenantId_fkey";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Note" DROP CONSTRAINT "Note_tenantId_fkey";
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "PromptVersion" DROP CONSTRAINT "PromptVersion_tenant_id_fkey";
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_tenantId_fkey";
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ProposalComment" DROP CONSTRAINT "ProposalComment_proposalId_fkey";
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ProposalComment" DROP CONSTRAINT "ProposalComment_tenantId_fkey";
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ProposalVersion" DROP CONSTRAINT "ProposalVersion_proposalId_fkey";
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "RateCard" DROP CONSTRAINT "RateCard_client_id_fkey";
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_client_id_fkey" FOREIGN KEY (client_id) REFERENCES "Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "RateCard" DROP CONSTRAINT "RateCard_tenant_id_fkey";
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "RecommendationAction" DROP CONSTRAINT "RecommendationAction_tenant_id_fkey";
ALTER TABLE "RecommendationAction" ADD CONSTRAINT "RecommendationAction_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "SharedDocument" DROP CONSTRAINT "SharedDocument_clientId_fkey";
ALTER TABLE "SharedDocument" ADD CONSTRAINT "SharedDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "SharedDocument" DROP CONSTRAINT "SharedDocument_tenantId_fkey";
ALTER TABLE "SharedDocument" ADD CONSTRAINT "SharedDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_siteId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_tenantId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Site" DROP CONSTRAINT "Site_tenantId_fkey";
ALTER TABLE "Site" ADD CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_guard_id_fkey";
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_guard_id_fkey" FOREIGN KEY (guard_id) REFERENCES "Guard"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_shift_id_fkey";
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_shift_id_fkey" FOREIGN KEY (shift_id) REFERENCES "Shift"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_site_id_fkey";
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_site_id_fkey" FOREIGN KEY (site_id) REFERENCES "Site"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_tenant_id_fkey";
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;
