import {
  AirbnbEmailEventKind,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import { resolveAuthoritativeHostPayout } from "@/lib/finance/resolve-authoritative-host-payout";

/** Eventos que pueden aportar montos contables a finanzas. */
export const FINANCE_REVENUE_EMAIL_EVENT_KINDS = new Set<AirbnbEmailEventKind>([
  AirbnbEmailEventKind.CONFIRMED,
  AirbnbEmailEventKind.UPDATED,
  AirbnbEmailEventKind.EXTENDED,
  AirbnbEmailEventKind.CHECKIN_REMINDER,
]);

export function isFinanceRevenueEmailEvent(
  eventKind: AirbnbEmailEventKind,
  reservationStatus: ReservationStatus,
): boolean {
  if (eventKind === AirbnbEmailEventKind.CANCELED) {
    return reservationStatus === ReservationStatus.CANCELLED;
  }
  return FINANCE_REVENUE_EMAIL_EVENT_KINDS.has(eventKind);
}

export type FinanceRevenueEmailEventRow = {
  reservationId: string | null;
  eventKind: AirbnbEmailEventKind;
  enrichedFields: unknown;
  payload: unknown;
};

export type FinanceRevenueEmailRawEmail = {
  html?: string;
  text?: string;
};

/** Evento con audit enlazado — requerido para selección por calidad en Finanzas. */
export type FinanceRevenueEmailEventWithAudit = FinanceRevenueEmailEventRow & {
  auditId?: string | null;
  processedAt?: Date | string | null;
  rawEmail?: FinanceRevenueEmailRawEmail | null;
};

export type FinanceRevenueReservationMeta = {
  reservationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
};

export type FinanceRevenueEmailCandidateScore = {
  authoritativeHostPayout: number | null;
  /** true cuando el payout no replica hostPayoutAmount corrupto en signals. */
  authoritativeIndependent: boolean;
  hasHtml: boolean;
  hasText: boolean;
  hasUsableBlob: boolean;
  processedAtMs: number;
};

function readStoredSignalHostPayout(payload: unknown): number | null {
  const signals = readPayloadSignals(payload);
  const value = Number(signals.hostPayoutAmount);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isAuthoritativeIndependentOfStoredSignals(
  payload: unknown,
  authoritativeHostPayout: number | null,
): boolean {
  if (authoritativeHostPayout == null) return false;
  const stored = readStoredSignalHostPayout(payload);
  if (stored == null) return true;
  return Math.abs(authoritativeHostPayout - stored) > 1;
}

function readPayloadSignals(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  const signals = (payload as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) {
    return {};
  }
  return signals as Record<string, unknown>;
}

function readRawEmailField(
  rawEmail: FinanceRevenueEmailRawEmail | null | undefined,
  field: "html" | "text",
): string | null {
  const value = rawEmail?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toProcessedAtMs(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

/** Evalúa un candidato usando rawEmail del audit enlazado al evento. */
export function scoreFinanceRevenueEmailCandidate(
  row: FinanceRevenueEmailEventWithAudit,
  meta: FinanceRevenueReservationMeta,
): FinanceRevenueEmailCandidateScore {
  const signals = readPayloadSignals(row.payload);
  const emailMatchBlob =
    typeof signals.emailMatchBlob === "string" ? signals.emailMatchBlob : null;
  const html = readRawEmailField(row.rawEmail, "html");
  const text = readRawEmailField(row.rawEmail, "text");

  const authoritative = resolveAuthoritativeHostPayout({
    confirmationCode: meta.reservationCode,
    checkIn: meta.checkIn,
    checkOut: meta.checkOut,
    emailMatchBlob,
    emailHtml: html,
    emailText: text,
    payloadSignals: signals,
    enrichedFields: row.enrichedFields,
  });

  const blobOnly =
    emailMatchBlob != null
      ? resolveAuthoritativeHostPayout({
          confirmationCode: meta.reservationCode,
          checkIn: meta.checkIn,
          checkOut: meta.checkOut,
          emailMatchBlob,
          emailHtml: null,
          emailText: null,
          payloadSignals: signals,
          enrichedFields: row.enrichedFields,
        })
      : null;

  const hasUsableBlob =
    Boolean(emailMatchBlob && emailMatchBlob.length > 0) &&
    blobOnly?.hostPayoutAmount != null;

  return {
    authoritativeHostPayout: authoritative.hostPayoutAmount,
    authoritativeIndependent: isAuthoritativeIndependentOfStoredSignals(
      row.payload,
      authoritative.hostPayoutAmount,
    ),
    hasHtml: html != null,
    hasText: text != null,
    hasUsableBlob,
    processedAtMs: toProcessedAtMs(row.processedAt),
  };
}

function compareFinanceRevenueCandidates(
  a: FinanceRevenueEmailCandidateScore,
  b: FinanceRevenueEmailCandidateScore,
): number {
  const aHasAuth = a.authoritativeHostPayout != null ? 1 : 0;
  const bHasAuth = b.authoritativeHostPayout != null ? 1 : 0;
  if (aHasAuth !== bHasAuth) return bHasAuth - aHasAuth;

  if (aHasAuth === 1 && bHasAuth === 1) {
    if (a.authoritativeIndependent !== b.authoritativeIndependent) {
      return Number(b.authoritativeIndependent) - Number(a.authoritativeIndependent);
    }
    return b.processedAtMs - a.processedAtMs;
  }

  if (a.hasHtml !== b.hasHtml) return Number(b.hasHtml) - Number(a.hasHtml);
  if (a.hasText !== b.hasText) return Number(b.hasText) - Number(a.hasText);
  if (a.hasUsableBlob !== b.hasUsableBlob) {
    return Number(b.hasUsableBlob) - Number(a.hasUsableBlob);
  }
  return b.processedAtMs - a.processedAtMs;
}

/**
 * Selecciona el mejor evento por calidad de información financiera (no por tipo).
 * Requiere rawEmail del audit enlazado a cada evento.
 */
export function pickFinanceRevenueEmailEventsByQuality<
  T extends FinanceRevenueEmailEventWithAudit,
>(
  rows: T[],
  reservationStatusById: Map<string, ReservationStatus>,
  reservationMetaById: Map<string, FinanceRevenueReservationMeta>,
): Map<string, T> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    if (!row.reservationId) continue;
    const status =
      reservationStatusById.get(row.reservationId) ??
      ReservationStatus.CONFIRMED;
    if (!isFinanceRevenueEmailEvent(row.eventKind, status)) continue;
    const list = grouped.get(row.reservationId) ?? [];
    list.push(row);
    grouped.set(row.reservationId, list);
  }

  const picked = new Map<string, T>();
  for (const [reservationId, list] of grouped) {
    const meta = reservationMetaById.get(reservationId) ?? {};
    const best = [...list].sort((left, right) => {
      const leftScore = scoreFinanceRevenueEmailCandidate(left, meta);
      const rightScore = scoreFinanceRevenueEmailCandidate(right, meta);
      return compareFinanceRevenueCandidates(leftScore, rightScore);
    })[0];
    if (best) picked.set(reservationId, best);
  }

  return picked;
}

/** @deprecated Usar pickFinanceRevenueEmailEventsByQuality en rutas de Finanzas. */
export function pickFinanceRevenueEmailEvents<
  T extends FinanceRevenueEmailEventRow,
>(
  rows: T[],
  reservationStatusById: Map<string, ReservationStatus>,
): Map<string, T> {
  const FINANCIAL_EVENT_PRIORITY: Partial<Record<AirbnbEmailEventKind, number>> =
    {
      [AirbnbEmailEventKind.UPDATED]: 40,
      [AirbnbEmailEventKind.EXTENDED]: 30,
      [AirbnbEmailEventKind.CHECKIN_REMINDER]: 20,
      [AirbnbEmailEventKind.CONFIRMED]: 10,
      [AirbnbEmailEventKind.CANCELED]: 0,
    };

  function hostPayoutFromRow(row: T): number {
    const payload = row.payload as { signals?: Record<string, unknown> } | null;
    const signals = payload?.signals ?? {};
    const enriched = (row.enrichedFields ?? {}) as Record<string, unknown>;
    for (const key of ["hostPayoutAmount", "netPayout", "grossAmount"]) {
      const value = Number(enriched[key] ?? signals[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.reservationId) continue;
    const status =
      reservationStatusById.get(row.reservationId) ??
      ReservationStatus.CONFIRMED;
    if (!isFinanceRevenueEmailEvent(row.eventKind, status)) continue;
    const list = grouped.get(row.reservationId) ?? [];
    list.push(row);
    grouped.set(row.reservationId, list);
  }

  const picked = new Map<string, T>();
  for (const [reservationId, list] of grouped) {
    const best = [...list].sort((a, b) => {
      const priorityDiff =
        (FINANCIAL_EVENT_PRIORITY[b.eventKind] ?? 0) -
        (FINANCIAL_EVENT_PRIORITY[a.eventKind] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return hostPayoutFromRow(b) - hostPayoutFromRow(a);
    })[0];
    if (best) picked.set(reservationId, best);
  }
  return picked;
}

export function isReservationFinanceTraceable(input: {
  platform: BookingPlatform;
  totalAmount: unknown;
  icalUid?: string | null;
  reservationCode?: string | null;
  emailRevenueAmount?: number | null;
}): boolean {
  const stored = Number(input.totalAmount?.toString?.() ?? input.totalAmount);
  if (Number.isFinite(stored) && stored > 0) return true;

  if (input.platform === BookingPlatform.DIRECT) {
    return Number.isFinite(stored) && stored > 0;
  }

  const emailAmount = Number(input.emailRevenueAmount);
  const hasEmailRevenue =
    Number.isFinite(emailAmount) && emailAmount > 0 && Boolean(input.icalUid?.trim());
  if (hasEmailRevenue) return true;

  const hasIcal = Boolean(input.icalUid?.trim());
  const hasCode = Boolean(input.reservationCode?.trim());
  return hasIcal && hasCode;
}
