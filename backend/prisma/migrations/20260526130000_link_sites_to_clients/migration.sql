ALTER TABLE "Site"
ADD COLUMN "client_id" TEXT;

CREATE INDEX "Site_client_id_idx" ON "Site"("client_id");

ALTER TABLE "Site"
ADD CONSTRAINT "Site_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
