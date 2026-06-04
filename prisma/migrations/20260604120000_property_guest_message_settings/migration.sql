-- Per-property guest message templates and reception WhatsApp; migrate org templates down.

ALTER TABLE "properties" ADD COLUMN "quickMessageTemplates" JSONB;
ALTER TABLE "properties" ADD COLUMN "receptionWhatsapp" TEXT;

UPDATE "properties" p
SET "quickMessageTemplates" = o."quickMessageTemplates"
FROM "organizations" o
WHERE p."organizationId" = o.id
  AND o."quickMessageTemplates" IS NOT NULL
  AND p."quickMessageTemplates" IS NULL;

ALTER TABLE "organizations" DROP COLUMN IF EXISTS "quickMessageTemplates";
