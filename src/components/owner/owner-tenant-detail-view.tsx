"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Eye,
  PauseCircle,
  PlayCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatDate } from "@/lib/helpers/date";

type TenantDetail = NonNullable<
  Awaited<
    ReturnType<
      typeof import("@/services/platform/owner-dashboard.service").getOwnerClientDetail
    >
  >
>;

type OwnerTenantDetailViewProps = {
  tenant: TenantDetail;
};

export function OwnerTenantDetailView({ tenant }: OwnerTenantDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(tenant.status);
  const [plan, setPlan] = useState(tenant.billing?.plan ?? "STARTER");
  const [billingStatus, setBillingStatus] = useState(
    tenant.billing?.status ?? "TRIAL",
  );

  function formatCop(amount: number) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  async function patchJson(url: string, body: Record<string, string>) {
    setError(null);
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            setError(data.error ?? "Acción no completada");
            resolve(false);
            return;
          }
          router.refresh();
          resolve(true);
        } catch {
          setError("Error de red");
          resolve(false);
        }
      });
    });
  }

  async function savePlan() {
    const ok = await patchJson(`/api/owner/tenant/${tenant.id}/plan`, { plan });
    if (ok) setError(null);
  }

  async function saveBillingStatus() {
    const ok = await patchJson(`/api/owner/tenant/${tenant.id}/billing`, {
      status: billingStatus,
    });
    if (ok) setError(null);
  }

  async function runAction(
    url: string,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(url, { method: "POST" });
        const data = (await res.json()) as { ok?: boolean; error?: string; redirectUrl?: string };
        if (!res.ok) {
          setError(data.error ?? "Acción no completada");
          return;
        }
        onSuccess?.();
        if (data.redirectUrl) {
          router.push(data.redirectUrl);
          router.refresh();
        } else {
          router.refresh();
        }
      } catch {
        setError("Error de red");
      }
    });
  }

  function impersonate() {
    runAction(`/api/owner/tenant/${tenant.id}/impersonate`, () => {
      router.push("/panel");
      router.refresh();
    });
  }

  function suspend() {
    runAction(`/api/owner/tenant/${tenant.id}/suspend`, () => setStatus("SUSPENDED"));
  }

  function reactivate() {
    runAction(`/api/owner/tenant/${tenant.id}/reactivate`, () => setStatus("ACTIVE"));
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 pb-16 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/owner-dashboard">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading truncate text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.mainEmail ?? "—"}</p>
        </div>
        <Badge variant={status === "SUSPENDED" ? "destructive" : "default"}>
          {status === "SUSPENDED" ? "Suspendido" : "Activo"}
        </Badge>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button type="button" variant="brand" disabled={pending || status === "SUSPENDED"} onClick={impersonate}>
          <Eye className="h-4 w-4" />
          Acceder al PMS (impersonación)
        </Button>
        {status === "ACTIVE" ? (
          <Button type="button" variant="outline" disabled={pending} onClick={suspend}>
            <PauseCircle className="h-4 w-4" />
            Suspender tenant
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={pending} onClick={reactivate}>
            <PlayCircle className="h-4 w-4" />
            Reactivar tenant
          </Button>
        )}
      </div>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Propiedades" value={String(tenant.propertyCount)} icon={Building2} />
        <KpiCard label="Usuarios" value={String(tenant.userCount)} icon={Users} />
        <KpiCard label="Reservas" value={String(tenant.reservationCount)} icon={CreditCard} />
        <KpiCard
          label="Ingresos reservas"
          value={formatCop(tenant.reservationRevenueCop)}
          detail={`Registro ${formatDate(tenant.createdAt)}`}
          icon={Building2}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <h2 className="mb-4 font-heading text-lg font-semibold">Facturación</h2>
          {tenant.billing ? (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tenant ID</dt>
                  <dd className="font-mono text-xs">{tenant.id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Próxima renovación</dt>
                  <dd className="font-medium">
                    {tenant.billing.currentPeriodEnd
                      ? formatDate(tenant.billing.currentPeriodEnd)
                      : tenant.billing.trialEndsAt
                        ? `Trial ${formatDate(tenant.billing.trialEndsAt)}`
                        : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as "STARTER" | "PRO")}
                    className="h-10 rounded-xl border border-input bg-white px-3 dark:bg-card"
                  >
                    <option value="STARTER">Starter</option>
                    <option value="PRO">Pro</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">Estado facturación</span>
                  <select
                    value={billingStatus}
                    onChange={(e) =>
                      setBillingStatus(
                        e.target.value as
                          | "TRIAL"
                          | "ACTIVE"
                          | "PAST_DUE"
                          | "CANCELED"
                          | "LOCKED",
                      )
                    }
                    className="h-10 rounded-xl border border-input bg-white px-3 dark:bg-card"
                  >
                    <option value="TRIAL">TRIAL</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAST_DUE">PAST_DUE</option>
                    <option value="LOCKED">LOCKED</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={savePlan}>
                  Guardar plan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={saveBillingStatus}
                >
                  Guardar estado billing
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin cuenta de facturación.</p>
          )}

          {tenant.billing?.invoices?.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.billing.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs">{inv.description ?? inv.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        {inv.amount} {inv.currency}
                      </TableCell>
                      <TableCell>{inv.status}</TableCell>
                      <TableCell>{formatDate(inv.dueAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <h2 className="mb-4 font-heading text-lg font-semibold">Usuarios del tenant</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                      {user.isAccountOwner ? (
                        <Badge variant="outline" className="ml-2">
                          Owner
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
        <h2 className="mb-4 font-heading text-lg font-semibold">Actividad auditada</h2>
        {tenant.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos para este tenant.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tenant.recentActivity.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
              >
                <span className="font-medium">{log.action}</span>
                <time className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
