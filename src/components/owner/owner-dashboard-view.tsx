"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CreditCard,
  DollarSign,
  Home,
  Search,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  OwnerClientsQuery,
  OwnerDashboardSnapshot,
} from "@/services/platform/owner-dashboard.service";
import type { PlatformAuditLog } from "@prisma/client";
import { formatDate } from "@/lib/helpers/date";
import { OwnerDashboardTableSkeleton } from "@/components/owner/owner-dashboard-skeletons";
import { OwnerSignOutButton } from "@/components/owner/owner-sign-out-button";
import {
  billingStatusBadge,
  formatOwnerCop,
  OWNER_DASHBOARD_TABS,
  tenantStatusBadge,
  type OwnerDashboardTab,
} from "@/components/owner/owner-dashboard-utils";
import { cn } from "@/lib/utils";

type ClientsResponse = {
  clients: {
    items: OwnerClientRow[];
    total: number;
    page: number;
    pageSize: number;
  };
  snapshot: OwnerDashboardSnapshot;
};

type OwnerDashboardViewProps = {
  initialClients: ClientsResponse["clients"];
  initialSnapshot: OwnerDashboardSnapshot;
  initialLogs: PlatformAuditLog[];
  isImpersonating?: boolean;
};

const billingStatusOptions = [
  { value: "ALL", label: "Todos los estados billing" },
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Activo" },
  { value: "PAST_DUE", label: "Vencido" },
  { value: "LOCKED", label: "Bloqueado" },
  { value: "CANCELED", label: "Cancelado" },
] as const;

const statusOptions = [
  { value: "ALL", label: "Todos los tenants" },
  { value: "ACTIVE", label: "Activos" },
  { value: "SUSPENDED", label: "Suspendidos" },
] as const;

const planOptions = [
  { value: "ALL", label: "Todos los planes" },
  { value: "STARTER", label: "Básico" },
  { value: "PRO", label: "Pro" },
] as const;

const sortOptions = [
  { value: "createdAt", label: "Registro" },
  { value: "name", label: "Nombre" },
  { value: "properties", label: "Propiedades" },
  { value: "revenue", label: "Ingresos reservas" },
] as const;

export function OwnerDashboardView({
  initialClients,
  initialSnapshot,
  initialLogs,
  isImpersonating = false,
}: OwnerDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<OwnerDashboardTab>("overview");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OwnerClientsQuery["status"]>("ALL");
  const [plan, setPlan] = useState<OwnerClientsQuery["plan"]>("ALL");
  const [billingStatus, setBillingStatus] =
    useState<OwnerClientsQuery["billingStatus"]>("ALL");
  const [sortBy, setSortBy] = useState<OwnerClientsQuery["sortBy"]>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(initialClients.page);
  const [clients, setClients] = useState(initialClients);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [logs] = useState(initialLogs);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const analytics = snapshot.analytics;
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
            billingStatus: billingStatus ?? "ALL",
          });
          if (search.trim()) params.set("search", search.trim());

          const res = await fetch(`/api/owner/clients?${params.toString()}`);
          const data = (await res.json()) as ClientsResponse & { error?: string };
          if (!res.ok) {
            setError(data.error ?? "No se pudo cargar datos");
            return;
          }
          setClients(data.clients);
          if (data.snapshot) setSnapshot(data.snapshot);
        } catch {
          setError("Error de red al cargar datos");
        }
      });
    },
    [billingStatus, clients.pageSize, page, plan, search, sortBy, sortDir, status],
  );

  useEffect(() => {
    if (activeTab !== "clients" && activeTab !== "subscriptions") return;
    const timer = window.setTimeout(() => {
      setPage(1);
      fetchClients(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, status, plan, billingStatus, sortBy, sortDir, activeTab, fetchClients]);

  function handlePageChange(next: number) {
    setPage(next);
    fetchClients(next);
  }

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 py-6 pb-16 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-pragma-electric">
            <Shield className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Centro de control · PRAGMA
            </span>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Owner Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Suscripciones, ingresos de plataforma, cartera por cobrar y operación de
            todos los clientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isImpersonating ? (
            <Button asChild variant="brandOutline">
              <Link href="/panel">Volver al PMS (impersonación)</Link>
            </Button>
          ) : (
            <OwnerSignOutButton />
          )}
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-1">
        {OWNER_DASHBOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-pragma-electric text-pragma-electric"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <OverviewPanel snapshot={snapshot} />
      ) : null}

      {activeTab === "subscriptions" ? (
        <SubscriptionsPanel
          clients={clients}
          snapshot={snapshot}
          pending={pending}
          search={search}
          setSearch={setSearch}
          billingStatus={billingStatus}
          setBillingStatus={setBillingStatus}
          plan={plan}
          setPlan={setPlan}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      ) : null}

      {activeTab === "revenue" ? <RevenuePanel snapshot={snapshot} /> : null}

      {activeTab === "clients" ? (
        <ClientsPanel
          clients={clients}
          pending={pending}
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          plan={plan}
          setPlan={setPlan}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortDir={sortDir}
          setSortDir={setSortDir}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      ) : null}

      {activeTab === "activity" ? <ActivityPanel logs={logs} /> : null}
    </div>
  );
}

function OverviewPanel({ snapshot }: { snapshot: OwnerDashboardSnapshot }) {
  const { analytics } = snapshot;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="MRR"
          value={formatOwnerCop(analytics.mrrEstimateCop)}
          detail={`ARR ${formatOwnerCop(analytics.arrEstimateCop)}`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Cobrado (30 días)"
          value={formatOwnerCop(analytics.paidRevenue30dCop)}
          detail={`Total histórico ${formatOwnerCop(analytics.paidRevenueAllTimeCop)}`}
          icon={Wallet}
        />
        <KpiCard
          label="Por cobrar"
          value={formatOwnerCop(analytics.openInvoicesTotalCop)}
          detail={`${analytics.openInvoicesCount} facturas abiertas`}
          icon={AlertTriangle}
        />
        <KpiCard
          label="Suscripciones activas"
          value={String(analytics.activeSubscriptions)}
          detail={`${analytics.trialTenants} trial · ${analytics.pastDueCount} vencidas`}
          icon={CreditCard}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft lg:col-span-1">
          <h2 className="mb-4 font-heading text-lg font-semibold">Estado suscripciones</h2>
          <ul className="space-y-2">
            {snapshot.subscriptionByStatus.map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                {billingStatusBadge(row.status)}
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft lg:col-span-1">
          <h2 className="mb-4 font-heading text-lg font-semibold">MRR por plan</h2>
          <ul className="space-y-2">
            {snapshot.subscriptionByPlan.map((row) => (
              <li
                key={row.plan}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <span>
                  {row.plan} <span className="text-muted-foreground">×{row.count}</span>
                </span>
                <span className="font-semibold">{formatOwnerCop(row.mrrCop)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft lg:col-span-1">
          <h2 className="mb-4 font-heading text-lg font-semibold">Plataforma</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Tenants</dt>
              <dd className="font-medium">
                {analytics.totalTenants} ({analytics.activeTenants} activos)
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Trials expiran (7d)</dt>
              <dd className="font-medium">{analytics.trialsExpiring7d}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Propiedades</dt>
              <dd className="font-medium">{analytics.totalProperties}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Ingresos reservas (GMV)</dt>
              <dd className="font-medium">
                {formatOwnerCop(analytics.platformReservationRevenueCop)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-pragma-electric" />
          <h2 className="font-heading text-lg font-semibold">Renovaciones próximas (7 días)</h2>
        </div>
        {snapshot.upcomingRenewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin renovaciones en los próximos 7 días.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Renueva</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.upcomingRenewals.map((row) => (
                  <TableRow key={`${row.organizationId}-${row.renewsAt}`}>
                    <TableCell>
                      <div className="font-medium">{row.organizationName}</div>
                      <div className="text-xs text-muted-foreground">{row.mainEmail}</div>
                    </TableCell>
                    <TableCell>{row.plan}</TableCell>
                    <TableCell>{billingStatusBadge(row.billingStatus)}</TableCell>
                    <TableCell>{formatDate(row.renewsAt)}</TableCell>
                    <TableCell>{formatOwnerCop(row.amountCop)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/owner-dashboard/tenant/${row.organizationId}`}>
                          Ver
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function SubscriptionsPanel({
  clients,
  snapshot,
  pending,
  search,
  setSearch,
  billingStatus,
  setBillingStatus,
  plan,
  setPlan,
  page,
  totalPages,
  onPageChange,
}: {
  clients: ClientsResponse["clients"];
  snapshot: OwnerDashboardSnapshot;
  pending: boolean;
  search: string;
  setSearch: (v: string) => void;
  billingStatus: OwnerClientsQuery["billingStatus"];
  setBillingStatus: (v: OwnerClientsQuery["billingStatus"]) => void;
  plan: OwnerClientsQuery["plan"];
  setPlan: (v: OwnerClientsQuery["plan"]) => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const { analytics } = snapshot;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Activas" value={String(analytics.activeSubscriptions)} icon={CreditCard} />
        <KpiCard label="En trial" value={String(analytics.trialTenants)} icon={Activity} />
        <KpiCard label="Vencidas" value={String(analytics.pastDueCount)} icon={AlertTriangle} />
        <KpiCard label="Starter / Pro" value={`${analytics.starterActiveCount} / ${analytics.proActiveCount}`} icon={Building2} />
      </section>

      <FilterBar
        search={search}
        setSearch={setSearch}
        plan={plan}
        setPlan={setPlan}
        billingStatus={billingStatus}
        setBillingStatus={setBillingStatus}
        showBillingFilter
      />

      <DataTableShell pending={pending} clients={clients} page={page} totalPages={totalPages} onPageChange={onPageChange}>
        <>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado billing</TableHead>
              <TableHead>Trial / Renovación</TableHead>
              <TableHead>MRR</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending && clients.items.length === 0 ? (
              <OwnerDashboardTableSkeleton rows={6} />
            ) : clients.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              clients.items.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-muted-foreground">{client.mainEmail}</div>
                  </TableCell>
                  <TableCell>{client.plan ?? "—"}</TableCell>
                  <TableCell>{billingStatusBadge(client.billingStatus)}</TableCell>
                  <TableCell>
                    {client.trialEndsAt
                      ? `Trial ${formatDate(client.trialEndsAt)}`
                      : client.currentPeriodEnd
                        ? formatDate(client.currentPeriodEnd)
                        : "—"}
                  </TableCell>
                  <TableCell>{formatOwnerCop(client.estimatedMrrCop)}</TableCell>
                  <TableCell>{tenantStatusBadge(client.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/owner-dashboard/tenant/${client.id}`}>Gestionar</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </>
      </DataTableShell>
    </div>
  );
}

function RevenuePanel({ snapshot }: { snapshot: OwnerDashboardSnapshot }) {
  const { analytics } = snapshot;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Ingresos suscripciones (30d)"
          value={formatOwnerCop(analytics.paidRevenue30dCop)}
          icon={DollarSign}
        />
        <KpiCard
          label="Cartera por cobrar"
          value={formatOwnerCop(analytics.openInvoicesTotalCop)}
          detail={`${analytics.openInvoicesCount} facturas`}
          icon={Wallet}
        />
        <KpiCard
          label="GMV reservas (tenants)"
          value={formatOwnerCop(analytics.platformReservationRevenueCop)}
          detail="Volumen procesado en PMS"
          icon={Home}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <InvoiceTable
          title="Facturas abiertas"
          emptyLabel="No hay facturas pendientes de cobro."
          rows={snapshot.openInvoices}
        />
        <InvoiceTable
          title="Pagos recientes"
          emptyLabel="Aún no hay pagos registrados."
          rows={snapshot.recentPayments}
        />
      </div>
    </div>
  );
}

function InvoiceTable({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: OwnerDashboardSnapshot["openInvoices"];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
      <h2 className="mb-4 font-heading text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/owner-dashboard/tenant/${inv.organizationId}`}
                      className="font-medium hover:text-pragma-electric"
                    >
                      {inv.organizationName}
                    </Link>
                  </TableCell>
                  <TableCell>{formatOwnerCop(inv.amount)}</TableCell>
                  <TableCell>{inv.status}</TableCell>
                  <TableCell>
                    {inv.paidAt ? formatDate(inv.paidAt) : formatDate(inv.dueAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function ClientsPanel(props: {
  clients: ClientsResponse["clients"];
  pending: boolean;
  search: string;
  setSearch: (v: string) => void;
  status: OwnerClientsQuery["status"];
  setStatus: (v: OwnerClientsQuery["status"]) => void;
  plan: OwnerClientsQuery["plan"];
  setPlan: (v: OwnerClientsQuery["plan"]) => void;
  sortBy: OwnerClientsQuery["sortBy"];
  setSortBy: (v: OwnerClientsQuery["sortBy"]) => void;
  sortDir: "asc" | "desc";
  setSortDir: (v: "asc" | "desc") => void;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const {
    clients,
    pending,
    search,
    setSearch,
    status,
    setStatus,
    plan,
    setPlan,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    page,
    totalPages,
    onPageChange,
  } = props;

  return (
    <div className="space-y-4">
      <FilterBar
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        plan={plan}
        setPlan={setPlan}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDir={sortDir}
        setSortDir={setSortDir}
        showTenantStatus
      />

      <DataTableShell pending={pending} clients={clients} page={page} totalPages={totalPages} onPageChange={onPageChange}>
        <>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Prop.</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Reservas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending && clients.items.length === 0 ? (
              <OwnerDashboardTableSkeleton rows={6} />
            ) : clients.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              clients.items.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.mainEmail ?? "—"}</TableCell>
                  <TableCell>{tenantStatusBadge(client.status)}</TableCell>
                  <TableCell>
                    <div>{client.plan ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{client.billingStatus}</div>
                  </TableCell>
                  <TableCell>{client.propertyCount}</TableCell>
                  <TableCell>{client.userCount}</TableCell>
                  <TableCell>{client.reservationCount}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/owner-dashboard/tenant/${client.id}`}>Detalle</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </>
      </DataTableShell>
    </div>
  );
}

function ActivityPanel({ logs }: { logs: PlatformAuditLog[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-pragma-electric" />
        <h2 className="font-heading text-lg font-semibold">Auditoría de acciones</h2>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border/70 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground">
                  {log.ownerEmail}
                  {log.targetTenantId ? ` · ${log.targetTenantId.slice(0, 8)}…` : ""}
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
  );
}

function FilterBar(props: {
  search: string;
  setSearch: (v: string) => void;
  plan: OwnerClientsQuery["plan"];
  setPlan: (v: OwnerClientsQuery["plan"]) => void;
  billingStatus?: OwnerClientsQuery["billingStatus"];
  setBillingStatus?: (v: OwnerClientsQuery["billingStatus"]) => void;
  status?: OwnerClientsQuery["status"];
  setStatus?: (v: OwnerClientsQuery["status"]) => void;
  sortBy?: OwnerClientsQuery["sortBy"];
  setSortBy?: (v: OwnerClientsQuery["sortBy"]) => void;
  sortDir?: "asc" | "desc";
  setSortDir?: (v: "asc" | "desc") => void;
  showBillingFilter?: boolean;
  showTenantStatus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-end">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
          placeholder="Buscar cliente, email o tenant ID"
          className="pl-9"
        />
      </div>
      {props.showTenantStatus && props.setStatus ? (
        <select
          value={props.status}
          onChange={(e) => props.setStatus!(e.target.value as OwnerClientsQuery["status"])}
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}
      <select
        value={props.plan}
        onChange={(e) => props.setPlan(e.target.value as OwnerClientsQuery["plan"])}
        className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
      >
        {planOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {props.showBillingFilter && props.setBillingStatus ? (
        <select
          value={props.billingStatus}
          onChange={(e) =>
            props.setBillingStatus!(e.target.value as OwnerClientsQuery["billingStatus"])
          }
          className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
        >
          {billingStatusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}
      {props.setSortBy && props.setSortDir ? (
        <>
          <select
            value={props.sortBy}
            onChange={(e) => props.setSortBy!(e.target.value as OwnerClientsQuery["sortBy"])}
            className="h-10 rounded-xl border border-input bg-white px-3 text-sm dark:bg-card"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Orden: {opt.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.setSortDir!(props.sortDir === "asc" ? "desc" : "asc")}
          >
            {props.sortDir === "asc" ? "Asc" : "Desc"}
          </Button>
        </>
      ) : null}
    </div>
  );
}

function DataTableShell({
  children,
  clients,
  page,
  totalPages,
  onPageChange,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
  clients: ClientsResponse["clients"];
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>{children}</Table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {clients.total} registros · página {clients.page} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || pending}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || pending}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </section>
  );
}
