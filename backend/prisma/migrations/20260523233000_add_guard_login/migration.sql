-- AlterTable
ALTER TABLE "Guard" ADD COLUMN "email" TEXT;
ALTER TABLE "Guard" ADD COLUMN "password_hash" TEXT;

-- CreateIndex
CREATE INDEX "Guard_email_idx" ON "Guard"("email");

-- CreateIndex
CREATE INDEX "Guard_phone_idx" ON "Guard"("phone");
