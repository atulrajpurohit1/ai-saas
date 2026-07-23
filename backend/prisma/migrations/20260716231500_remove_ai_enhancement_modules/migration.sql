-- DropTable
-- NOTE: AiConversation contains real data at the time this migration was
-- written (9 rows of AI Copilot chat history). Confirm this data is no
-- longer needed before applying.
DROP TABLE IF EXISTS "AiConversation" CASCADE;
