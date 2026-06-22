import { BarChart3, Target, TrendingUp, UserCheck, Users } from "lucide-react";
import { MOCK_SALES_ANALYTICS } from "@/features/sales-console/data/mock-analytics";
import { KpiCard } from "@/components/ui/kpi-card";

export function AnalyticsMockView() {
  const data = MOCK_SALES_ANALYTICS;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Storytelling metrics · fixed mock values for F1.5 preview.
      </p>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Generated prospects"
          value={String(data.generatedProspects)}
          icon={Users}
        />
        <KpiCard
          label="Qualified"
          value={String(data.qualifiedProspects)}
          icon={Target}
        />
        <KpiCard
          label="Contacted"
          value={String(data.contactedProspects)}
          icon={UserCheck}
        />
        <KpiCard label="Customers" value={String(data.customers)} icon={TrendingUp} />
        <KpiCard
          label="Conversion"
          value={`${data.conversionRate}%`}
          icon={BarChart3}
          className="sm:col-span-2 xl:col-span-1"
        />
      </section>
    </div>
  );
}
