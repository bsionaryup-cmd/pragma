"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  Building2,
  CalendarClock,
  CreditCard,
  Home,
  Search,
  Shield,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
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
import type {
  OwnerClientRow,
  OwnerDashboardAnalytics,
  OwnerClientsQuery,
} from "@/services/platform/owner-dashboard.service";
import type { PlatformAuditLog } from "@prisma/client";
import { formatDate } from "@/lib/helpers/date";
import { OwnerDashboardTableSkeleton } from "@/components/owner/owner-dashboard-skeletons";

type ClientsResponse = {
  clients: {
    items: OwnerClientRow[];
    total: number;
    page: number;
    pageSize: number;
  };
  analytics: OwnerDashboardAnalytics;
};

type OwnerDashboardViewProps = {
  initialClients: ClientsResponse["clients"];
  initialAnalytics: OwnerDashboardAnalytics;
  initialLogs: PlatformAuditLog[];
  isImpersonating?: boolean;
};

const statusOptions = [
  { value: "ALL", label: "Todos los estados" },
  { value: "ACTIVE", label: "Activos" },
  { value: "SUSPENDED", label: "Suspendidos" },
] as const;

const planOptions = [
  { value: "ALL", label: "Todos los planes" },
  { value: "STARTER", label: "Starter" },
  { value: "PRO", label: "Pro" },
] as const;

const sortOptions = [
  { value: "createdAt", label: "Fecha registro" },
  { value: "name", label: "Nombre" },
  { value: "properties", label: "Propiedades" },
  { value: "users", label: "Usuarios" },
  { value: "reservations", label: "Reservas" },
] as const;

function formatCop(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusBadge(status: string) {
  if (status === "SUSPENDED") {
    return <Badge variant="destructive">Suspendido</Badge>;
  }
  return <Badge variant="default">Activo</Badge>;
}

export function OwnerDashboardView({
  initialClients,
  initialAnalytics,
  initialLogs,
  isImpersonating = false,
}: OwnerDashboardViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OwnerClientsQuery["status"]>("ALL");
  const [plan, setPlan] = useState<OwnerClientsQuery["plan"]>("ALL");
  const [sortBy, setSortBy] = useState<OwnerClientsQuery["sortBy"]>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(initialClients.page);
  const [clients, setClients] = useState(initialClients);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [logs, setLogs] = useState(initialLogs);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(clients.total / clients.pageSize)),
    [clients.total, clients.pageSize],
  );

  const fetchClients = useCallback(
    (nextPage = page) => {
      startTransition(async () => {
        setError(null);
        try {
          const params = new URLSearchParams({
            page: String(nextPage),
            pageSize: String(clients.pageSize),
            sortBy: sortBy ?? "createdAt",
            sortDir,
            status: status ?? "ALL",
            plan: plan ?? "ALL",
          });
          if (search.trim()) params.set("search", search.trim());

          const res = await fetch(`/api/owner/clients?${params.toString()}`);
          const data = (await res.json()) as ClientsResponse & { error?: string };
          if (!res.ok) {
            setError(data.error ?? "No se pudo cargar el listado de clientes");
            return;
          }
          setClients(data.clients);
          setAnalytics(data.analytics);
        } catch {
          setError("Error de red al cargar clientes");
        }
      });
    },
    [clients.pageSize, page, plan, search, sortBy, sortDir, status],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      fetchClients(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, status, plan, sortBy, sortDir, fetchClients]);

  function handlePageChange(next: number) {
    setPage(next);
    fetchClients(next);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-16 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-pragma-electric">
            <Shield className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Super Admin Owner
            </span>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Owner Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visibilidad global de tenants, facturación e impersonación segura.
          </p>
        </div>
        {isImpersonating ? (
          <Button asChild variant="brandOutline">
            <Link href="/panel">Volver al PMS (impersonación activa)</Link>
          </Button>
        ) : null}
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tenants totales"
          value={String(analytics.totalTenants)}
          detail={`${analytics.activeTenants} activos · ${analytics.suspendedTenants} suspendidos`}
          icon={Building2}
        />
        <KpiCard
          label="Suscripciones activas"
          value={String(analytics.activeSubscriptions)}
          detail={`${analytics.trialTenants} en prueba`}
          icon={CreditCard}
        />
        <KpiCard
          label="Propiedades / usuarios"
          value={`${analytics.totalProperties} / ${analytics.totalUsers}`}
          detail={`${analytics.totalReservations} reservas activas`}
          icon={Home}
        />
        <KpiCard
          label="MRR estimado"
          value={formatCop(analytics.mrrEstimateCop)}
          detail="Basado en planes activos"
          icon={Activity}
        />
      </section>

      <section className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email o tenant ID"
                className="pl-9"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OwnerClientsQuery["status"])}
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as OwnerClientsQuery["plan"])}
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
            >
              {planOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as OwnerClientsQuery["sortBy"])
              }
              className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Ordenar: {opt.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            >
              {sortDir === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Propiedades</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Reservas</TableHead>
                <TableHead>Ingresos reservas</TableHead>
                <TableHead>Facturación</TableHead>
                <TableHead>Renovación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending && clients.items.length === 0 ? (
                <OwnerDashboardTableSkeleton rows={8} />
              ) : clients.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                    No hay clientes que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                clients.items.map((client) => (
                  <TableRow key={client.id} className={pending ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      <div>{client.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(client.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>{client.mainEmail ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{client.id.slice(0, 8)}…</TableCell>
                    <TableCell>{statusBadge(client.status)}</TableCell>
                    <TableCell>
                      <div>{client.plan ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {client.billingStatus ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>{client.propertyCount}</TableCell>
                    <TableCell>{client.userCount}</TableCell>
                    <TableCell>{client.reservationCount}</TableCell>
                    <TableCell>{formatCop(client.reservationRevenueCop)}</TableCell>
                    <TableCell>
                      <div>{client.openInvoiceAmount != null ? formatCop(client.openInvoiceAmount) : "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        MRR {client.estimatedMrrCop != null ? formatCop(client.estimatedMrrCop) : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.currentPeriodEnd
                        ? formatDate(client.currentPeriodEnd)
                        : client.trialEndsAt
                          ? `Trial ${formatDate(client.trialEndsAt)}`
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/owner-dashboard/tenant/${client.id}`}>
                            Detalle
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {clients.total} clientes · página {clients.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || pending}
              onClick={() => handlePageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || pending}
              onClick={() => handlePageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-pragma-electric" />
          <h2 className="font-heading text-lg font-semibold">Actividad reciente</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad registrada aún.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/70 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.ownerEmail}
                    {log.targetTenantId ? ` · tenant ${log.targetTenantId.slice(0, 8)}…` : ""}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt.toISOString())}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
