-- Click-to-dial call logging.
--
-- Lead.phone is new and nullable: every existing lead was created without a
-- number, and a lead with no number is still a valid lead -- it just cannot be
-- dialed from the app.
ALTER TABLE "Lead" ADD COLUMN "phone" TEXT;

-- One row per dial initiated from the app. See the CallRecord model comment in
-- schema.prisma for why there is no recording or provider identifier here.
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "deal_id" TEXT,
    "phone_number" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "outcome" TEXT NOT NULL DEFAULT 'dialed',
    "duration_sec" INTEGER,
    "notes" TEXT,
    "transcript" TEXT,
    "discovery_session_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallRecord_tenant_id_idx" ON "CallRecord"("tenant_id");
CREATE INDEX "CallRecord_tenant_id_lead_id_idx" ON "CallRecord"("tenant_id", "lead_id");
CREATE INDEX "CallRecord_tenant_id_deal_id_idx" ON "CallRecord"("tenant_id", "deal_id");
CREATE INDEX "CallRecord_tenant_id_created_at_idx" ON "CallRecord"("tenant_id", "created_at");

ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: deleting a lead must not erase the record that someone
-- was called. The dial happened whether or not the CRM row survives.
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_deal_id_fkey"
    FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
