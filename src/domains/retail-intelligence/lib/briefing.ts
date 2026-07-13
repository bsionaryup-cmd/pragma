/**
 * Operational briefing for Centro de Abastecimiento.
 * Answers only: what should the tender do today?
 */

export type BriefingTone = "urgent" | "watch" | "ok";

export type BriefingLine = {
  tone: BriefingTone;
  text: string;
};

export type SupplyBriefing = {
  greeting: string;
  lines: BriefingLine[];
  recommendedAction: string | null;
};

function greetingForHour(hour: number) {
  if (hour < 12) return "Buenos días.";
  if (hour < 19) return "Buenas tardes.";
  return "Buenas noches.";
}

export function buildSupplyBriefing(input: {
  now?: Date;
  cashOpen: boolean;
  urgentOrderCount: number;
  soonOrderCount: number;
  waitSupplierNames: string[];
  runningOutProductCount: number;
  topUrgentSupplierName: string | null;
}): SupplyBriefing {
  const now = input.now ?? new Date();
  const bogotaHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  const lines: BriefingLine[] = [];

  if (input.urgentOrderCount > 0) {
    lines.push({
      tone: "urgent",
      text: `Aprobar ${input.urgentOrderCount} pedido${input.urgentOrderCount === 1 ? "" : "s"} urgente${input.urgentOrderCount === 1 ? "" : "s"}.`,
    });
  }

  for (const name of input.waitSupplierNames.slice(0, 2)) {
    lines.push({
      tone: "watch",
      text: `Esperar el pedido de ${name} hasta completar cobertura.`,
    });
  }

  if (input.cashOpen) {
    lines.push({ tone: "ok", text: "Caja abierta correctamente." });
  } else {
    lines.push({ tone: "watch", text: "Abre caja para aprobar o enviar pedidos." });
  }

  if (input.runningOutProductCount > 0) {
    lines.push({
      tone: "watch",
      text: `Hay ${input.runningOutProductCount} producto${input.runningOutProductCount === 1 ? "" : "s"} próximo${input.runningOutProductCount === 1 ? "" : "s"} a agotarse.`,
    });
  }

  if (input.soonOrderCount > 0 && input.urgentOrderCount === 0) {
    lines.push({
      tone: "watch",
      text: `Revisar ${input.soonOrderCount} pedido${input.soonOrderCount === 1 ? "" : "s"} próximos.`,
    });
  }

  if (!lines.length) {
    lines.push({
      tone: "ok",
      text: "No hay acciones urgentes de abastecimiento hoy.",
    });
  }

  const recommendedAction = input.topUrgentSupplierName
    ? `Revisar el pedido de ${input.topUrgentSupplierName}.`
    : input.soonOrderCount > 0
      ? "Revisar pedidos próximos a vencer cobertura."
      : !input.cashOpen
        ? "Abrir caja para operar abastecimiento."
        : null;

  return {
    greeting: greetingForHour(bogotaHour),
    lines,
    recommendedAction,
  };
}

export type VisualPriority = "URGENT" | "SOON" | "NORMAL";

export function mapVisualPriority(input: {
  priority: string;
  daysOfCover: number | null;
  leadTimeDays: number;
}): VisualPriority {
  if (input.priority === "CRITICAL" || input.priority === "HIGH") return "URGENT";
  if (
    input.daysOfCover != null &&
    input.daysOfCover <= Math.max(input.leadTimeDays + 3, 5)
  ) {
    return "URGENT";
  }
  if (input.priority === "MEDIUM" || (input.daysOfCover != null && input.daysOfCover <= 14)) {
    return "SOON";
  }
  return "NORMAL";
}

export function visualPriorityLabel(priority: VisualPriority) {
  if (priority === "URGENT") return "Urgente";
  if (priority === "SOON") return "Pronto";
  return "Normal";
}

export function explainRecommendation(input: {
  action: string;
  stock: number;
  suggestedQty: number;
  avgDailySales7: number;
  leadTimeDays: number;
  daysOfCover: number | null;
  targetCoverDays?: number;
  supplierPickReason?: string | null;
}): {
  decision: string;
  motivo: string;
  details: Array<{ label: string; value: string }>;
} {
  const target = input.targetCoverDays ?? Math.max(7, input.leadTimeDays + 5);
  const velocity = Math.round(input.avgDailySales7 * 10) / 10;

  const decisionMap: Record<string, string> = {
    BUY_NOW: "Comprar ahora",
    BUY_SOON: "Comprar pronto",
    CRITICAL: "Comprar urgente",
    RUNNING_OUT: "Reponer antes de agotar",
    HIGH_ROTATION: "Aumentar pedido",
    WAIT: "Esperar",
    DO_NOT_REORDER: "No comprar",
    OVERSTOCKED: "No comprar · sobre inventario",
    NO_ROTATION: "No comprar · sin rotación",
    PROMOTE: "Promocionar producto",
    SWITCH_SUPPLIER: "Cambiar proveedor",
    INCREASE_STOCK_TARGET: "Aumentar pedido",
    DECREASE_STOCK_TARGET: "Reducir pedido",
  };

  let motivo = "Según rotación y cobertura objetivo.";
  if (input.action === "BUY_NOW" || input.action === "CRITICAL" || input.action === "RUNNING_OUT") {
    motivo = `Rotación promedio ${velocity || "baja"} und/día; entrega ${input.leadTimeDays}d; cobertura objetivo ${target}d.`;
  } else if (input.action === "WAIT") {
    motivo = "La cobertura actual alcanza hasta el próximo ciclo de compra.";
  } else if (input.action === "PROMOTE" || input.action === "OVERSTOCKED") {
    motivo = "Hay exceso de existencia frente a la demanda reciente.";
  } else if (input.action === "NO_ROTATION" || input.action === "DO_NOT_REORDER") {
    motivo = "Sin ventas recientes; no conviene reponer.";
  } else if (input.action === "DECREASE_STOCK_TARGET") {
    motivo = "La demanda bajó; conviene pedir menos.";
  } else if (input.action === "INCREASE_STOCK_TARGET" || input.action === "HIGH_ROTATION") {
    motivo = "La demanda subió; conviene pedir más.";
  }

  if (input.supplierPickReason) {
    motivo = `${motivo} ${input.supplierPickReason}`;
  }

  return {
    decision: decisionMap[input.action] ?? "Revisar",
    motivo,
    details: [
      { label: "Existencia", value: String(input.stock) },
      { label: "IA recomienda", value: String(input.suggestedQty) },
      {
        label: "Cobertura",
        value: input.daysOfCover != null ? `${Math.round(input.daysOfCover)} días` : "—",
      },
      { label: "Entrega proveedor", value: `${input.leadTimeDays} días` },
      { label: "Cobertura objetivo", value: `${target} días` },
      { label: "Rotación promedio", value: `${velocity} por día` },
    ],
  };
}

/** Score suppliers for auto-pick (higher is better). Deterministic, no randomness. */
export function scoreSupplierOption(input: {
  leadTimeDays: number;
  cost: number;
  reliabilityScore: number;
  onTimeRate: number;
}): number {
  const leadScore = 1 / (1 + Math.max(0, input.leadTimeDays));
  const costScore = 1 / (1 + Math.max(0, input.cost));
  const reliability = Math.min(1, Math.max(0, input.reliabilityScore || input.onTimeRate || 0.7));
  return leadScore * 0.4 + costScore * 0.35 + reliability * 0.25;
}
