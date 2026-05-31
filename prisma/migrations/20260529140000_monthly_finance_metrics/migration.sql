-- CreateTable
CREATE TABLE "monthly_finance_metrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "availableNights" INTEGER NOT NULL DEFAULT 0,
    "occupiedNights" INTEGER NOT NULL DEFAULT 0,
    "occupancyPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "projectedRevenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_finance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_finance_metrics_organizationId_month_idx" ON "monthly_finance_metrics"("organizationId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_finance_metrics_organizationId_propertyId_month_key" ON "monthly_finance_metrics"("organizationId", "propertyId", "month");

-- AddForeignKey
ALTER TABLE "monthly_finance_metrics" ADD CONSTRAINT "monthly_finance_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_finance_metrics" ADD CONSTRAINT "monthly_finance_metrics_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
