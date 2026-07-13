import { AlertTriangle, Bot, Check, X } from "lucide-react";
import { resolveSuggestionAction } from "@/domains/retail/actions/retail.actions";
import { getProductsData, getPurchasesData } from "@/domains/retail/services/retail-ui.service";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailAiPage() {
  const [{ products }, { suggestions }] = await Promise.all([getProductsData(), getPurchasesData()]);
  const critical = products.filter((product) => product.stock <= product.minStock);
  const groups = suggestions.reduce((result, item) => {
    const key = item.supplierId || "sin-proveedor";
    result.set(key, [...(result.get(key) ?? []), item]);
    return result;
  }, new Map<string, typeof suggestions>());

  return (
    <TiendasOnScreen title="Inteligencia de inventario" backHref="/intiendas/compras">
      <div className="grid gap-4 p-4 lg:grid-cols-[300px_1fr]">
        <section className="rounded-md border border-[#d5dce6] bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#2d3748]">Productos críticos</h3>
          <div className="space-y-2">
            {critical.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-md border border-[#edf2f7] bg-[#f8fafc] p-3"
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#2d3748]">{product.name}</p>
                  <p className="text-xs text-[#718096]">
                    Stock {product.stock} · mínimo {product.minStock}
                  </p>
                </div>
              </div>
            ))}
            {!critical.length ? (
              <p className="text-sm text-[#718096]">El inventario está saludable.</p>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          {[...groups.entries()].map(([supplierId, items], index) => (
            <section key={supplierId} className="rounded-md border border-[#d5dce6] bg-white p-4">
              <h3 className="text-sm font-semibold text-[#2d3748]">
                {supplierId === "sin-proveedor" ? "Sin proveedor asignado" : `Proveedor sugerido ${index + 1}`}
              </h3>
              <p className="mb-3 text-xs text-[#718096]">{items.length} recomendaciones pendientes</p>
              <div className="divide-y divide-[#edf2f7]">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pragma-electric/10 text-pragma-electric">
                      <Bot className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#2d3748]">{item.product.name}</p>
                      <p className="text-sm text-[#718096]">
                        Comprar {item.suggestedQty} unidades · costo estimado{" "}
                        {formatIntiendasMoney(item.estimatedCost)}
                      </p>
                    </div>
                    <form action={resolveSuggestionAction} className="flex gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <TiendasOnPrimaryButton type="submit" name="intent" value="approve" className="h-8 gap-1 px-3 text-xs">
                        <Check className="size-3.5" /> Aprobar
                      </TiendasOnPrimaryButton>
                      <button
                        type="submit"
                        name="intent"
                        value="dismiss"
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#c5ced8] px-3 text-xs text-[#4a5568]"
                      >
                        <X className="size-3.5" /> Omitir
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {!suggestions.length ? (
            <section className="rounded-md border border-[#d5dce6] bg-white p-6 text-sm text-[#718096]">
              No hay recomendaciones pendientes.
            </section>
          ) : null}
        </div>
      </div>
    </TiendasOnScreen>
  );
}
