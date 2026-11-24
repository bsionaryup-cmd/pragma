-- Drop AI Concierge + Assistant Platform + Inbox AI (product removal).
-- Historical create migrations remain for audit; this migration removes live tables.

DROP TABLE IF EXISTS "concierge_audit_events" CASCADE;
DROP TABLE IF EXISTS "concierge_conversation_states" CASCADE;
DROP TABLE IF EXISTS "concierge_extension_links" CASCADE;
DROP TABLE IF EXISTS "concierge_configurations" CASCADE;

DROP TABLE IF EXISTS "assistant_knowledge_provider_bindings" CASCADE;
DROP TABLE IF EXISTS "assistant_knowledge_articles" CASCADE;
DROP TABLE IF EXISTS "assistant_playbook_versions" CASCADE;
DROP TABLE IF EXISTS "assistant_definitions" CASCADE;

DROP TABLE IF EXISTS "inbox_ai_draft_audit_events" CASCADE;
DROP TABLE IF EXISTS "inbox_ai_drafts" CASCADE;

DROP TYPE IF EXISTS "ConciergeOperationMode";
DROP TYPE IF EXISTS "ConciergeExtensionLinkStatus";
DROP TYPE IF EXISTS "ConciergeConversationStatus";
DROP TYPE IF EXISTS "ConciergeRuntimeStatus";
DROP TYPE IF EXISTS "AssistantStatus";
DROP TYPE IF EXISTS "InboxAiDraftStatus";
DROP TYPE IF EXISTS "InboxAiDraftAuditAction";

-- Drop obsolete manual Tasks product table (AirbnbEmailTask + TaskStatus retained).
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TYPE IF EXISTS "TaskType";