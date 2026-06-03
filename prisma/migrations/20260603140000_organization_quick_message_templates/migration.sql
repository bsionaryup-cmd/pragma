-- Move quick message templates from properties to organization (tenant-wide defaults).

ALTER TABLE "organizations" ADD COLUMN "quickMessageTemplates" JSONB;

UPDATE "organizations" o
SET "quickMessageTemplates" = sub.templates
FROM (
  SELECT DISTINCT ON (p."organizationId")
    p."organizationId",
    p."quickMessageTemplates" AS templates
  FROM "properties" p
  WHERE p."organizationId" IS NOT NULL
    AND p."quickMessageTemplates" IS NOT NULL
  ORDER BY p."organizationId", p."updatedAt" DESC
) sub
WHERE o.id = sub."organizationId";

ALTER TABLE "properties" DROP COLUMN "quickMessageTemplates";
