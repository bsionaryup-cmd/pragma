-- PRAGMA Web Builder (tenant public sites)

CREATE TYPE "WebSiteStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'PUBLISHED',
  'UNPUBLISHED'
);

CREATE TYPE "WebSiteTemplate" AS ENUM (
  'URBAN_BOUTIQUE'
);

CREATE TYPE "WebMediaCategory" AS ENUM (
  'HERO',
  'LOGO',
  'GALLERY',
  'LOCATION',
  'PROPERTY',
  'SOCIAL',
  'OTHER'
);

CREATE TYPE "WebMediaProvenance" AS ENUM (
  'UPLOAD',
  'PROPERTY_IMPORT',
  'CSV_IMPORT',
  'JSON_IMPORT',
  'EXTERNAL_URL',
  'ADMIN_PROVIDED'
);

CREATE TYPE "WebContentReviewStatus" AS ENUM (
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "tenant_web_sites" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "siteName" TEXT NOT NULL,
  "template" "WebSiteTemplate" NOT NULL DEFAULT 'URBAN_BOUTIQUE',
  "status" "WebSiteStatus" NOT NULL DEFAULT 'DRAFT',
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#1F1F1F',
  "accentColor" TEXT NOT NULL DEFAULT '#6B7F3B',
  "softWhite" TEXT NOT NULL DEFAULT '#F6F4F1',
  "sandOak" TEXT NOT NULL DEFAULT '#D8C7AE',
  "urbanGray" TEXT NOT NULL DEFAULT '#7C7A78',
  "stoneTaupe" TEXT NOT NULL DEFAULT '#8B7E72',
  "matteBlack" TEXT NOT NULL DEFAULT '#1F1F1F',
  "fontFamily" TEXT NOT NULL DEFAULT 'editorial',
  "heroTitle" TEXT,
  "heroSubtitle" TEXT,
  "heroImageUrl" TEXT,
  "aboutText" TEXT,
  "locationNeighborhood" TEXT,
  "locationCity" TEXT,
  "locationCountry" TEXT DEFAULT 'Colombia',
  "locationDescription" TEXT,
  "locationImageUrl" TEXT,
  "locationMapUrl" TEXT,
  "whatsapp" TEXT,
  "contactEmail" TEXT,
  "instagramUrl" TEXT,
  "facebookUrl" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "seoCanonicalUrl" TEXT,
  "ogImageUrl" TEXT,
  "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "currency" TEXT NOT NULL DEFAULT 'COP',
  "locale" TEXT NOT NULL DEFAULT 'es',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_web_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_web_pages" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "status" "WebSiteStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_web_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_web_media" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "siteId" TEXT,
  "propertyId" TEXT,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "category" "WebMediaCategory" NOT NULL DEFAULT 'GALLERY',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "alt" TEXT,
  "description" TEXT,
  "provenance" "WebMediaProvenance" NOT NULL DEFAULT 'EXTERNAL_URL',
  "rightsNote" TEXT,
  "reviewStatus" "WebContentReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_web_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_web_site_properties" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "customTitle" TEXT,
  "customDescription" TEXT,
  "customCoverUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_web_site_properties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_web_sites_organizationId_key" ON "tenant_web_sites"("organizationId");
CREATE UNIQUE INDEX "tenant_web_sites_slug_key" ON "tenant_web_sites"("slug");
CREATE INDEX "tenant_web_sites_status_idx" ON "tenant_web_sites"("status");

CREATE UNIQUE INDEX "tenant_web_pages_siteId_slug_key" ON "tenant_web_pages"("siteId", "slug");
CREATE INDEX "tenant_web_pages_siteId_sortOrder_idx" ON "tenant_web_pages"("siteId", "sortOrder");

CREATE INDEX "tenant_web_media_organizationId_category_idx" ON "tenant_web_media"("organizationId", "category");
CREATE INDEX "tenant_web_media_siteId_sortOrder_idx" ON "tenant_web_media"("siteId", "sortOrder");
CREATE INDEX "tenant_web_media_propertyId_idx" ON "tenant_web_media"("propertyId");

CREATE UNIQUE INDEX "tenant_web_site_properties_siteId_propertyId_key" ON "tenant_web_site_properties"("siteId", "propertyId");
CREATE INDEX "tenant_web_site_properties_siteId_sortOrder_idx" ON "tenant_web_site_properties"("siteId", "sortOrder");

ALTER TABLE "tenant_web_sites"
  ADD CONSTRAINT "tenant_web_sites_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_web_pages"
  ADD CONSTRAINT "tenant_web_pages_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "tenant_web_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_web_media"
  ADD CONSTRAINT "tenant_web_media_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_web_media"
  ADD CONSTRAINT "tenant_web_media_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "tenant_web_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_web_media"
  ADD CONSTRAINT "tenant_web_media_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_web_site_properties"
  ADD CONSTRAINT "tenant_web_site_properties_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "tenant_web_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_web_site_properties"
  ADD CONSTRAINT "tenant_web_site_properties_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;