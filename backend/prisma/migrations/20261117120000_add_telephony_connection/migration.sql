-- RingCentral telephony integration.
--
-- Purely additive. Existing CallRecord rows read back with source = NULL,
-- which is exactly what they are: manually logged calls whose duration and
-- outcome the rep typed. Nothing about the manual logging path changes.

CREATE TABLE IF NOT EXISTS "TelephonyConnection" (
    "id"                      TEXT NOT NULL,
    "tenant_id"               TEXT NOT NULL,
    "provider"                TEXT NOT NULL DEFAULT 'ringcentral',
    "status"                  TEXT NOT NULL DEFAULT 'connected',
    "credential"              TEXT NOT NULL,
    "external_account_id"     TEXT,
    "external_account_name"   TEXT,
    "subscription_id"         TEXT,
    "subscription_expires_at" TIMESTAMP(3),
    "webhook_secret"          TEXT NOT NULL,
    "scopes"                  TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_sync_at"            TIMESTAMP(3),
    "last_error"              TEXT,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelephonyConnection_pkey" PRIMARY KEY ("id")
);

-- One connection per provider per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "TelephonyConnection_tenant_provider_key"
    ON "TelephonyConnection" ("tenant_id", "provider");

-- A RingCentral account may back only ONE tenant. Without this, two tenants
-- could connect the same account and each would receive the other's calls.
CREATE UNIQUE INDEX IF NOT EXISTS "TelephonyConnection_provider_account_key"
    ON "TelephonyConnection" ("provider", "external_account_id");

CREATE INDEX IF NOT EXISTS "TelephonyConnection_tenant_id_idx"
    ON "TelephonyConnection" ("tenant_id");

-- Drives the renewal scheduler's "expiring soon" query.
CREATE INDEX IF NOT EXISTS "TelephonyConnection_subscription_expires_at_idx"
    ON "TelephonyConnection" ("subscription_expires_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TelephonyConnection_tenant_id_fkey'
    ) THEN
        ALTER TABLE "TelephonyConnection"
            ADD CONSTRAINT "TelephonyConnection_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Provenance and idempotency for calls that arrive from a phone system.
ALTER TABLE "CallRecord" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN IF NOT EXISTS "external_session_id" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN IF NOT EXISTS "external_recording_id" TEXT;

-- The idempotency key for webhook ingestion. RingCentral delivers the same
-- telephony session more than once (retries, plus one event per party), so
-- this index is what makes a replay a no-op rather than a duplicate call row.
--
-- Manually logged rows all have external_session_id = NULL and are unaffected:
-- Postgres treats NULLs as DISTINCT in a unique index, so any number of them
-- coexist. Left as a plain (non-partial) index deliberately, to match what
-- Prisma's @@unique generates -- a partial index here would read as schema
-- drift on every subsequent migrate.
CREATE UNIQUE INDEX IF NOT EXISTS "CallRecord_tenant_external_session_key"
    ON "CallRecord" ("tenant_id", "external_session_id");
