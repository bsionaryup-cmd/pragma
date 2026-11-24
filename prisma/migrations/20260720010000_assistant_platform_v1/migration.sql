-- Assistant Platform v1 — additive tables (non-destructive)

CREATE TYPE "AssistantStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "assistant_definitions" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "organizationId" TEXT,
  "status" "AssistantStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_playbook_versions" (
  "id" TEXT NOT NULL,
  "assistantId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "label" TEXT,
  "identityJson" JSONB NOT NULL DEFAULT '{}',
  "promptJson" JSONB NOT NULL DEFAULT '{}',
  "guardRailsJson" JSONB NOT NULL DEFAULT '{}',
  "messageTemplatesJson" JSONB NOT NULL DEFAULT '{}',
  "protocolsJson" JSONB NOT NULL DEFAULT '{}',
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistant_playbook_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_knowledge_articles" (
  "id" TEXT NOT NULL,
  "assistantId" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'FAQ',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "propertyId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_knowledge_articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistant_knowledge_provider_bindings" (
  "id" TEXT NOT NULL,
  "assistantId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configJson" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_knowledge_provider_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_definitions_publishedVersionId_key" ON "assistant_definitions"("publishedVersionId");
CREATE UNIQUE INDEX "assistant_definitions_organizationId_slug_key" ON "assistant_definitions"("organizationId", "slug");
CREATE INDEX "assistant_definitions_organizationId_status_idx" ON "assistant_definitions"("organizationId", "status");

CREATE UNIQUE INDEX "assistant_playbook_versions_assistantId_version_key" ON "assistant_playbook_versions"("assistantId", "version");
CREATE INDEX "assistant_playbook_versions_assistantId_publishedAt_idx" ON "assistant_playbook_versions"("assistantId", "publishedAt");

CREATE INDEX "assistant_knowledge_articles_assistantId_category_enabled_idx" ON "assistant_knowledge_articles"("assistantId", "category", "enabled");
CREATE INDEX "assistant_knowledge_articles_propertyId_idx" ON "assistant_knowledge_articles"("propertyId");

CREATE UNIQUE INDEX "assistant_knowledge_provider_bindings_assistantId_providerKey_key" ON "assistant_knowledge_provider_bindings"("assistantId", "providerKey");
CREATE INDEX "assistant_knowledge_provider_bindings_assistantId_enabled_idx" ON "assistant_knowledge_provider_bindings"("assistantId", "enabled");

ALTER TABLE "assistant_definitions" ADD CONSTRAINT "assistant_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_playbook_versions" ADD CONSTRAINT "assistant_playbook_versions_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "assistant_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_definitions" ADD CONSTRAINT "assistant_definitions_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "assistant_playbook_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_articles" ADD CONSTRAINT "assistant_knowledge_articles_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "assistant_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_knowledge_provider_bindings" ADD CONSTRAINT "assistant_knowledge_provider_bindings_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "assistant_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
