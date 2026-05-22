-- Performance indexes for inbox sort, dashboard KPIs, and calendar property loads.

CREATE INDEX "reservations_status_checkIn_idx" ON "reservations"("status", "checkIn");
CREATE INDEX "reservations_createdAt_idx" ON "reservations"("createdAt" DESC);
CREATE INDEX "properties_status_idx" ON "properties"("status");
