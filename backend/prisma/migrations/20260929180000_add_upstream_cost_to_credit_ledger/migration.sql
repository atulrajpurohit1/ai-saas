-- Records what BlackPearl actually charged us for a job, in USD.
--
-- Nullable on purpose: BlackPearl does not always report usage, and every
-- existing row predates any cost being captured at all. NULL means "not
-- reported", which is different from 0.00 and must not be averaged as if it
-- were zero.
ALTER TABLE "CreditLedgerEntry"
  ADD COLUMN "upstream_cost_usd" DECIMAL(12, 6);
