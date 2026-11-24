-- Additive Concierge memory / conversation state (ephemeral facts + state machine).
ALTER TABLE "concierge_conversation_states"
  ADD COLUMN "factsJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "conversationStateJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "recentMessagesJson" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "factsExpiresAt" TIMESTAMP(3),
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "reservationId" TEXT;

CREATE INDEX "concierge_conversation_states_factsExpiresAt_idx"
  ON "concierge_conversation_states"("factsExpiresAt");
