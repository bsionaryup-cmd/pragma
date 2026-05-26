"use client";

import { useEffect, useState } from "react";
import { getReservationEmailEnrichmentAction } from "@/features/reservations/actions/reservation-email-enrichment.actions";
import { reservationHasVisibleEmailEnrichment } from "@/lib/airbnb-email/reservation-enrichment-visibility";
import { formatDateTime } from "@/lib/helpers/date";
import type { ReservationEmailEnrichmentDetail } from "@/services/reservations/reservation-email-enrichment.service";

type Props = {
  reservationId: string;
  platform: string;
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {value}
    </p>
  );
}

export function ReservationEmailEnrichmentSection({
  reservationId,
  platform,
}: Props) {
  const [detail, setDetail] = useState<ReservationEmailEnrichmentDetail | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (platform !== "AIRBNB") return;
    let cancelled = false;
    setLoaded(false);
    void getReservationEmailEnrichmentAction(reservationId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId, platform]);

  if (platform !== "AIRBNB") return null;
  if (!loaded) return null;
  if (!detail) return null;

  const hasAny = reservationHasVisibleEmailEnrichment(detail);

  if (!hasAny) {
    return (
      <section className="space-y-2 rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-3">
        <h4 className="text-xs font-medium text-muted-foreground">
          Airbnb Email Enrichment
        </h4>
        <p className="text-xs text-muted-foreground">
          Sin correos Airbnb vinculados a esta reserva aún.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
      <h4 className="text-xs font-medium text-muted-foreground">
        Airbnb Email Enrichment
      </h4>
      <div className="space-y-1">
        <Row
          label="Código reserva"
          value={detail.reservationCodeFromEmail}
        />
        <Row label="Último evento" value={detail.lastEventKind} />
        {detail.lastMatchConfidence != null ? (
          <Row
            label="Confianza match"
            value={`${Math.round(detail.lastMatchConfidence * 100)}% (${detail.lastMatchMethod ?? "—"})`}
          />
        ) : null}
        {detail.latestPayout ? (
          <>
            <Row
              label="Pago neto"
              value={
                detail.latestPayout.net
                  ? `${detail.latestPayout.currency} ${detail.latestPayout.net}`
                  : null
              }
            />
            <Row label="Comisión host" value={detail.latestPayout.hostFee} />
            <Row
              label="Reconciliación"
              value={detail.latestPayout.reconciliationStatus}
            />
          </>
        ) : null}
        {detail.communicationCount > 0 ? (
          <Row
            label="Mensajes"
            value={
              detail.pendingCommunicationActions > 0
                ? `${detail.communicationCount} · acción pendiente`
                : String(detail.communicationCount)
            }
          />
        ) : null}
        {detail.reviewCount > 0 ? (
          <Row
            label="Reseñas"
            value={
              detail.pendingReviewResponse
                ? "Respuesta pendiente"
                : detail.latestRating != null
                  ? `${detail.latestRating}★`
                  : String(detail.reviewCount)
            }
          />
        ) : null}
        {detail.manualReviewPending ? (
          <Row label="Revisión manual" value="Pendiente" />
        ) : null}
        {detail.pendingTaskCount > 0 ? (
          <Row
            label="Tareas email"
            value={detail.pendingTaskKinds.join(", ")}
          />
        ) : null}
        <Row
          label="Último procesado"
          value={
            detail.lastProcessedAt
              ? formatDateTime(detail.lastProcessedAt)
              : null
          }
        />
      </div>
    </section>
  );
}
