import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { listRetailStores } from "@/modules/retail-admin/services/retail-admin-store.service";

type StoreRow = Awaited<ReturnType<typeof listRetailStores>>[number];

function licenseLabel(store: StoreRow) {
  if (store.deletedAt) return { label: "Revocada", variant: "destructive" as const };
  if (store.status === "INACTIVE") return { label: "Suspendida", variant: "secondary" as const };
  return { label: "Activa", variant: "default" as const };
}

export function RetailLicensesView({ stores }: { stores: StoreRow[] }) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        La licencia operativa de INTIENDAS se deriva del estado de la tienda (sin billing paralelo al PMS).
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tienda</th>
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Licencia</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const license = licenseLabel(store);
              return (
                <tr key={store.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{store.name}</td>
                  <td className="px-4 py-3">{store.organizationName}</td>
                  <td className="px-4 py-3">
                    <Badge variant={license.variant}>{license.label}</Badge>
                  </td>
                  <td className="px-4 py-3">INTIENDAS MVP</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/owner-dashboard/intiendas/tiendas/${store.id}`}>Gestionar</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {stores.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No hay tiendas registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
