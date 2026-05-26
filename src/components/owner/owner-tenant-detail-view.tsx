"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Building2,
  CreditCard,
  Eye,
  PauseCircle,
  PlayCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
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
import type { BillingPlanCode } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import {
  formatCop,
  getPlanDefinition,
  PLAN_CATALOG,
} from "@/modules/billing/domain/plan-catalog";
import { parseSalesBillingMetadata } from "@/modules/sales/domain/sales-billing-metadata";

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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("RECEPTIONIST");
  const [tenantName, setTenantName] = useState(tenant.name);
  const [deleteReason, setDeleteReason] = useState("");
  const [propertySlots, setPropertySlots] = useState(() => {
    const meta = parseSalesBillingMetadata(tenant.billing?.metadata);
    return String(meta.propertySlots ?? tenant.propertyCount ?? 1);
  });
  const [extendTrialDays, setExtendTrialDays] = useState("7");

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
    body?: unknown,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
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

  async function inviteUser() {
    if (!inviteEmail.trim()) {
      setError("Ingresa un email para invitar");
      return;
    }
    runAction(
      `/api/owner/tenant/${tenant.id}/users/invite`,
      () => {
        setInviteEmail("");
        router.refresh();
      },
      { email: inviteEmail.trim(), role: inviteRole },
    );
  }

  async function patchUser(userId: string, path: string, body: unknown) {
    setError(null);
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/owner/tenant/${tenant.id}/users/${userId}/${path}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
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

  function softDeleteUser(userId: string) {
    runAction(`/api/owner/tenant/${tenant.id}/users/${userId}/delete`, () => router.refresh(), {
      reason: "owner_ops",
    });
  }

  async function updatePropertySlots() {
    const slots = Number.parseInt(propertySlots, 10);
    if (!Number.isFinite(slots) || slots < 1) {
      setError("propertySlots inválido");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/owner/tenant/${tenant.id}/billing-actions/limits`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertySlots: slots, reason: "owner_ops" }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Acción no completada");
          return;
        }
        router.refresh();
      } catch {
        setError("Error de red");
      }
    });
  }

  function billingAction(path: string, body?: unknown) {
    runAction(`/api/owner/tenant/${tenant.id}/billing-actions/${path}`, () => router.refresh(), body);
  }

  async function saveTenantName() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/owner/tenant/${tenant.id}/update`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tenantName, reason: "owner_ops" }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Acción no completada");
          return;
        }
        router.refresh();
      } catch {
        setError("Error de red");
      }
    });
  }

  function softDeleteTenant() {
    if (deleteReason.trim().length < 3) {
      setError("Indica un reason (mínimo 3 caracteres)");
      return;
    }
    runAction(`/api/owner/tenant/${tenant.id}/delete`, () => router.push("/owner-dashboard"), {
      reason: deleteReason.trim(),
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 pb-16 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <BackLink href="/owner-dashboard" label="Owner Dashboard" />
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
          <h2 className="mb-4 font-heading text-lg font-semibold">Tenant Management</h2>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">Nombre del negocio</span>
              <input
                className="h-10 rounded-xl border border-input bg-background px-3"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={saveTenantName}>
                Guardar nombre
              </Button>
            </div>

            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-semibold text-destructive">Soft delete tenant</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Desactiva usuarios (no owner), suspende tenant y cancela suscripción. No hard delete.
              </p>
              <input
                className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                placeholder="Reason (ej. fraude, duplicado, solicitud cliente)…"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
              <div className="mt-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={softDeleteTenant}
                >
                  Soft delete
                </Button>
              </div>
            </div>
          </div>
        </section>

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
                    onChange={(e) =>
                      setPlan(e.target.value as "STARTER" | "PRO" | "SCALE")
                    }
                    className="h-10 rounded-xl border border-input bg-white px-3 dark:bg-card"
                  >
                    {(Object.keys(PLAN_CATALOG) as BillingPlanCode[]).map((code) => {
                      const def = getPlanDefinition(code);
                      return (
                        <option key={code} value={code}>
                          {def.name} ({formatCop(def.pricePerPropertyCop)}/prop.)
                        </option>
                      );
                    })}
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

              <div className="mt-6 grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-sm font-semibold">Acciones billing (Owner)</p>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">Límite facturable (propertySlots)</span>
                  <div className="flex gap-2">
                    <input
                      className="h-10 w-full rounded-xl border border-input bg-background px-3"
                      value={propertySlots}
                      onChange={(e) => setPropertySlots(e.target.value.replace(/\\D/g, "").slice(0, 4))}
                    />
                    <Button type="button" variant="outline" disabled={pending} onClick={updatePropertySlots}>
                      Guardar
                    </Button>
                  </div>
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-muted-foreground">Extender trial (días)</span>
                    <input
                      className="h-10 rounded-xl border border-input bg-background px-3"
                      value={extendTrialDays}
                      onChange={(e) => setExtendTrialDays(e.target.value.replace(/\\D/g, "").slice(0, 2))}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        billingAction("extend-trial", {
                          days: Number.parseInt(extendTrialDays || "7", 10),
                          reason: "owner_ops",
                        })
                      }
                    >
                      Extender
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => billingAction("block-trial", { reason: "owner_ops" })}
                    >
                      Bloquear trial
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={pending} onClick={() => billingAction("activate", { reason: "owner_ops" })}>
                    Activar suscripción
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => billingAction("pause", { reason: "owner_ops" })}>
                    Pausar
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => billingAction("reactivate", { reason: "owner_ops" })}>
                    Reactivar
                  </Button>
                  <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => billingAction("cancel", { reason: "owner_ops" })}>
                    Cancelar
                  </Button>
                </div>
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
          <div className="mb-4 grid gap-2 rounded-xl border border-border/80 bg-muted/20 p-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              placeholder="Invitar admin/recepcionista (email)…"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="RECEPTIONIST">RECEPTIONIST</option>
            </select>
            <Button type="button" disabled={pending} onClick={inviteUser}>
              Invitar (Clerk)
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead />
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
                    <TableCell>
                      {user.isAccountOwner ? (
                        <span className="text-sm">{user.role}</span>
                      ) : (
                        <select
                          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                          defaultValue={user.role}
                          disabled={pending}
                          onChange={(e) =>
                            void patchUser(user.id, "role", {
                              role: e.target.value,
                              reason: "owner_ops",
                            })
                          }
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="RECEPTIONIST">RECEPTIONIST</option>
                        </select>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{String((user as any).isActive ?? true)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || user.isAccountOwner}
                          onClick={() =>
                            void patchUser(user.id, "active", {
                              isActive: !((user as any).isActive ?? true),
                              reason: "owner_ops",
                            })
                          }
                        >
                          {((user as any).isActive ?? true) ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || user.isAccountOwner}
                          onClick={() => softDeleteUser(user.id)}
                        >
                          Soft delete
                        </Button>
                      </div>
                    </TableCell>
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
