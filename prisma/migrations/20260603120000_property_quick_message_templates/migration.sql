-- Optional per-property overrides for reservation quick message buttons

ALTER TABLE "properties" ADD COLUMN "quickMessageTemplates" JSONB;
