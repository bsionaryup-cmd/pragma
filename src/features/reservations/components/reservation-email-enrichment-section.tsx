"use client";

import { useEffect, useState } from "react";
import {
  getReservationEmailEnrichmentAction,
  manualReservationEnrichmentResolverAction,
} from "@/features/reservations/actions/reservation-email-enrichment.actions";
import { Button } from "@/components/ui/button";
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
  const [isLinking, setIsLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const reloadDetail = () =>
    getReservationEmailEnrichmentAction(reservationId).then((data) => {
      setDetail(data);
      return data;
    });

  useEffect(() => {
    if (platform !== "AIRBNB") return;
    let cancelled = false;
    setLoaded(false);
    void reloadDetail()
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

  const linkedToReservation = detail.linkedAuditCount > 0 || detail.emailEventCount > 0;
  if (!linkedToReservation && detail.propertyAuditCount > 0) {
    return (
      <section className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3">
        <h4 className="text-xs font-medium text-muted-foreground">
          Airbnb Email Enrichment
        </h4>
        <p className="text-xs text-muted-foreground">
          {detail.propertyAuditCount === 1
            ? "Hay 1 correo Airbnb procesado para esta propiedad que aún no se vinculó a esta reserva."
            : `Hay ${detail.propertyAuditCount} correos Airbnb procesados para esta propiedad que aún no se vincularon a esta reserva.`}
        </p>
        <p className="text-xs text-muted-foreground">
          Reenvía el correo de confirmación o revisa que el huésped y las fechas coincidan con el iCal.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isLinking}
            onClick={() => {
              setIsLinking(true);
              setLinkMessage(null);
              void manualReservationEnrichmentResolverAction(reservationId)
                .then((result) => {
                  if (result.status === "linked") {
                    setLinkMessage("Vinculación Airbnb aplicada correctamente.");
                  } else {
                    setLinkMessage("No se encontró una coincidencia razonable para vincular.");
                  }
                  return reloadDetail();
                })
                .catch(() => {
                  setLinkMessage("No fue posible vincular automáticamente el correo Airbnb.");
                })
                .finally(() => {
                  setIsLinking(false);
                });
            }}
          >
            {isLinking ? "Vinculando..." : "Vincular automáticamente"}
          </Button>
          {linkMessage ? (
            <p className="text-xs text-muted-foreground">{linkMessage}</p>
          ) : null}
        </div>
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
