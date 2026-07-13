import { getPedidosDashboard } from "@/domains/retail-intelligence";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { refreshPedidosIntelligenceAction } from "@/domains/retail/actions/pedidos.actions";
import { CashGateBanner, hasOpenCash } from "@/domains/retail/ui/tiendas-on/cash-gate";
import { PedidosIntelClient } from "@/domains/retail/ui/tiendas-on/pedidos-intel";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailPedidosPage() {
  const ctx = await requireRetailContext();
  const cashOpen = await hasOpenCash();
  const data = await getPedidosDashboard(ctx.store.id);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <TiendasOnScreen title="Centro de Abastecimiento">
      <CashGateBanner moduleLabel="Centro de Abastecimiento" />

      {isDev ? (
        <form
          action={refreshPedidosIntelligenceAction}
          className="border-b border-dashed border-[#d5dce6] bg-[#f8fafc] px-4 py-2"
        >
          <button type="submit" className="text-xs text-[#a0aec0] underline">
            [dev] Actualizar inteligencia
          </button>
        </form>
      ) : null}

      <PedidosIntelClient
        cashOpen={cashOpen}
        briefing={data.briefing}
        orders={data.ordersBySupplier}
        suppliers={data.suppliers}
        products={data.products}
      />
    </TiendasOnScreen>
  );
}
