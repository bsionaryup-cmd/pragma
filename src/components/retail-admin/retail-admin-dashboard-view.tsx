import Link from "next/link";
import { Building2, CircleDollarSign, Package, ShoppingCart, Store, Users } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import type { RetailAdminDashboardStats } from "@/modules/retail-admin/services/retail-admin-dashboard.service";

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function RetailAdminDashboardView({ stats }: { stats: RetailAdminDashboardStats }) {
  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Tiendas" value={String(stats.storesTotal)} detail={`${stats.storesActive} activas · ${stats.storesSuspended} suspendidas`} icon={Store} />
        <KpiCard label="Productos" value={String(stats.productsTotal)} detail="Productos registrados en la plataforma" icon={Package} />
        <KpiCard label="Ventas de hoy" value={String(stats.salesTodayCount)} detail="Transacciones completadas" icon={ShoppingCart} />
        <KpiCard label="Monto vendido hoy" value={money.format(stats.salesTodayAmount)} detail="Total consolidado de INTIENDAS" icon={CircleDollarSign} />
        <KpiCard label="Organizaciones con tienda" value={String(stats.orgsWithStore)} detail="Cobertura activa del producto" icon={Building2} />
        <KpiCard label="Usuarios y acceso" value="Gestionar" detail="Invitaciones, roles y estado" icon={Users} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-pragma-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-heading font-semibold">Accesos rápidos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Administra el producto o abre la experiencia operativa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:text-pragma-electric" href="/owner-dashboard/intiendas/tiendas">Gestionar tiendas</Link>
            <Link className="rounded-lg border px-4 py-2 text-sm font-medium hover:text-pragma-electric" href="/intiendas/login">Abrir INTIENDAS</Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-pragma-soft">
        <h3 className="font-heading font-semibold">Tiendas recientes</h3>
        <div className="mt-4 divide-y">
          {stats.recentStores.length ? stats.recentStores.map((store) => (
            <Link key={store.id} href={`/owner-dashboard/intiendas/tiendas/${store.id}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-pragma-electric">
              <span><strong>{store.name}</strong><span className="ml-2 text-muted-foreground">{store.organizationName}</span></span>
              <span>{store.deletedAt ? "Eliminada" : store.status === "ACTIVE" ? "Activa" : "Suspendida"}</span>
            </Link>
          )) : <p className="py-4 text-sm text-muted-foreground">No hay tiendas registradas.</p>}
        </div>
      </section>
    </div>
  );
}
