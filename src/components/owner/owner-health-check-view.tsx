import { cn } from "@/lib/utils";
import type { PlatformHealthSnapshot, HealthStatus } from "@/services/platform/platform-health.service";

function badgeClass(status: HealthStatus) {
  if (status === "PASS") return "bg-emerald-100 text-emerald-800";
  if (status === "WARN") return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-800";
}

export function OwnerHealthCheckView({ snapshot }: { snapshot: PlatformHealthSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado global</p>
          <p className="mt-1 text-2xl font-semibold">{snapshot.overall}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generado {new Date(snapshot.generatedAt).toLocaleString("es-CO", {
              timeZone: "America/Bogota",
            })}{" "}
            (America/Bogota)
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-3 py-1 text-sm font-bold",
            badgeClass(snapshot.overall),
          )}
        >
          {snapshot.overall}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Componente</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.checks.map((check) => (
              <tr key={check.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{check.label}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-bold", badgeClass(check.status))}>
                    {check.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{check.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-heading text-base font-semibold">Inventory Intelligence — outbox</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          PENDING {snapshot.intel.pending} · FAILED {snapshot.intel.failed} · PROCESSING{" "}
          {snapshot.intel.processing}
          {snapshot.intel.lastDoneAt
            ? ` · último DONE ${new Date(snapshot.intel.lastDoneAt).toLocaleString("es-CO", {
                timeZone: "America/Bogota",
              })}`
            : " · sin DONE aún"}
        </p>
        {snapshot.intel.recentFailed.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {snapshot.intel.recentFailed.map((row) => (
              <li key={row.id} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900">
                <span className="font-medium">{row.type}</span> · store {row.storeId.slice(-8)} ·
                intentos {row.attempts}
                {row.lastError ? ` — ${row.lastError}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Sin eventos FAILED recientes.</p>
        )}
      </section>
    </div>
  );
}
