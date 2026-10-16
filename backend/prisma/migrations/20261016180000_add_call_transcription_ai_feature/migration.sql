-- Audio transcription ran on its own Gemini/OpenAI client, outside AiService,
-- so it was charged no credits and logged no AiUsageEvent -- the spend was
-- both free to the customer and invisible to us. Metering it needs a feature
-- of its own: AiFeature.OTHER would have charged the light tier and buried
-- the usage in the bucket that exists to signal omissions.
--
-- Audio is among the most expensive inputs per call, hence the heavy tier in
-- ai-credit-costs.constants.ts.

ALTER TYPE "AiFeature" ADD VALUE 'CALL_TRANSCRIPTION';
