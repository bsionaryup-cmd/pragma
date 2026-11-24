-- Digital Receptionist V1: knowledge base + thread memory facts

CREATE TABLE IF NOT EXISTS "digital_receptionist_knowledge_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "digital_receptionist_knowledge_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "digital_receptionist_knowledge_entries_org_active_cat_idx"
  ON "digital_receptionist_knowledge_entries"("organizationId", "isActive", "category");
CREATE INDEX IF NOT EXISTS "digital_receptionist_knowledge_entries_property_active_idx"
  ON "digital_receptionist_knowledge_entries"("propertyId", "isActive");

ALTER TABLE "digital_receptionist_knowledge_entries"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_knowledge_entries_organizationId_fkey";
ALTER TABLE "digital_receptionist_knowledge_entries"
  ADD CONSTRAINT "digital_receptionist_knowledge_entries_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "digital_receptionist_knowledge_entries"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_knowledge_entries_propertyId_fkey";
ALTER TABLE "digital_receptionist_knowledge_entries"
  ADD CONSTRAINT "digital_receptionist_knowledge_entries_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "digital_receptionist_thread_facts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "factKey" TEXT NOT NULL,
    "factValue" TEXT NOT NULL,
    "sourceMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "digital_receptionist_thread_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "digital_receptionist_thread_facts_unique"
  ON "digital_receptionist_thread_facts"("organizationId", "channel", "threadKey", "factKey");
CREATE INDEX IF NOT EXISTS "digital_receptionist_thread_facts_thread_idx"
  ON "digital_receptionist_thread_facts"("organizationId", "channel", "threadKey");

ALTER TABLE "digital_receptionist_thread_facts"
  DROP CONSTRAINT IF EXISTS "digital_receptionist_thread_facts_organizationId_fkey";
ALTER TABLE "digital_receptionist_thread_facts"
  ADD CONSTRAINT "digital_receptionist_thread_facts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
