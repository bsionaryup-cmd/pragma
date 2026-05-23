import { Badge } from "@/components/ui/badge";

export function formatOwnerCop(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function tenantStatusBadge(status: string) {
  if (status === "SUSPENDED") {
    return <Badge variant="destructive">Suspendido</Badge>;
  }
  return <Badge variant="default">Activo</Badge>;
}

const billingStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  TRIAL: "secondary",
  ACTIVE: "default",
  PAST_DUE: "destructive",
  LOCKED: "destructive",
  CANCELED: "outline",
};

export function billingStatusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">Sin plan</Badge>;
  return (
    <Badge variant={billingStatusVariant[status] ?? "outline"}>{status}</Badge>
  );
}

export type OwnerDashboardTab =
  | "overview"
  | "subscriptions"
  | "revenue"
  | "clients"
  | "activity";

export const OWNER_DASHBOARD_TABS: {
  id: OwnerDashboardTab;
  label: string;
}[] = [
  { id: "overview", label: "Resumen" },
  { id: "subscriptions", label: "Suscripciones" },
  { id: "revenue", label: "Ingresos" },
  { id: "clients", label: "Clientes" },
  { id: "activity", label: "Actividad" },
];
