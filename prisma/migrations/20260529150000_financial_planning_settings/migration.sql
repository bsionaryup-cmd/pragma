-- CreateTable
CREATE TABLE "financial_planning_settings" (
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "fixedExpenses" JSONB NOT NULL DEFAULT '[]',
    "variableExpenses" JSONB NOT NULL DEFAULT '[]',
    "monthlyProfitGoal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_planning_settings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE INDEX "financial_planning_settings_propertyId_idx" ON "financial_planning_settings"("propertyId");

-- AddForeignKey
ALTER TABLE "financial_planning_settings" ADD CONSTRAINT "financial_planning_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_planning_settings" ADD CONSTRAINT "financial_planning_settings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
