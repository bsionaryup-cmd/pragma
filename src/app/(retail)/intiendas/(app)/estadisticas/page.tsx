import { getStatisticsData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnSummaryCard,
  TiendasOnSummaryRow,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";
import { BarChart3 } from "lucide-react";

export default async function RetailStatisticsPage() {
  const stats = await getStatisticsData();
  return (
    <TiendasOnScreen title="Estadísticos">
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <TiendasOnSummaryCard
          title="Últimos 30 días"
          accent="pragma"
          icon={<BarChart3 className="size-5 text-pragma-electric" />}
        >
          <TiendasOnSummaryRow label="Ventas" value={formatIntiendasMoney(stats.salesTotal)} tone="positive" />
          <TiendasOnSummaryRow label="Transacciones" value={String(stats.salesCount)} />
          <TiendasOnSummaryRow label="Compras" value={formatIntiendasMoney(stats.purchasesTotal)} tone="negative" />
          <TiendasOnSummaryRow label="Órdenes recibidas" value={String(stats.purchasesCount)} />
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard title="Productos más vendidos" accent="pragma" icon={<BarChart3 className="size-5 text-pragma-electric" />}>
          {stats.topProducts.length ? (
            stats.topProducts.map((product) => (
              <TiendasOnSummaryRow
                key={product.name}
                label={product.name}
                value={`${product.quantity} und`}
              />
            ))
          ) : (
            <p className="text-sm text-[#718096]">Sin datos de ventas aún.</p>
          )}
        </TiendasOnSummaryCard>
      </div>
    </TiendasOnScreen>
  );
}
