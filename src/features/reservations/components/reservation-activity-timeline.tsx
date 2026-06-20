"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Mail,
  MessageCircleQuestion,
} from "lucide-react";
import type { ReservationActivityType } from "@prisma/client";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import {
  displayStatusLabels,
  resolveDisplayStatus,
} from "@/features/reservations/lib/reservation-status";
import { formatDateTime } from "@/lib/helpers/date";
import type { ReservationActivityRow } from "@/services/reservation-activity/reservation-activity-list.service";
import { resolveGuestMessageForDisplay } from "@/services/novedades/operational-feed.message";
import {
  isInquiryActivityMetadata,
  resolveReservationActivityDisplayTitle,
} from "@/features/reservations/lib/inquiry-activity";
import { cn } from "@/lib/utils";

type TimelineEntry = {
  id: string;
  kind: ReservationActivityType | "RESERVATION_CREATED" | "GUEST_REGISTRATION";
  title: string;
  content: string;
  senderName: string | null;
  createdAt: string;
  createdAtFormatted: string;
  metadata?: unknown;
};

function readMetadataDates(metadata: unknown): {
  original?: string | null;
  requested?: string | null;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const original = (metadata as { originalDates?: { raw?: unknown } }).originalDates?.raw;
  const requested = (metadata as { requestedDates?: { raw?: unknown } }).requestedDates?.raw;
  return {
    original: typeof original === "string" ? original : null,
    requested: typeof requested === "string" ? requested : null,
  };
}

function buildSyntheticTimelineEntries(
  reservation: ReservationDetailItem,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const displayStatus = resolveDisplayStatus(reservation.status);

  if (reservation.createdAt) {
    entries.push({
      id: `${reservation.id}-created`,
      kind: "RESERVATION_CREATED",
      title: "Reserva creada",
      content:
        reservation.platform === "AIRBNB"
          ? "Reserva confirmada desde Airbnb."
          : `Reserva ${displayStatusLabels[displayStatus].toLowerCase()}.`,
      senderName: null,
      createdAt: reservation.createdAt,
      createdAtFormatted: formatDateTime(reservation.createdAt, "—", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    });
  }

  if (reservation.guestRegistration?.url) {
    entries.push({
      id: `${reservation.id}-registration`,
      kind: "GUEST_REGISTRATION",
      title: "Enlace de registro enviado",
      content: "Se generó el enlace de registro de huéspedes.",
      senderName: null,
      createdAt: reservation.guestRegistration.createdAt,
      createdAtFormatted: formatDateTime(
        reservation.guestRegistration.createdAt,
        "—",
        { dateStyle: "medium", timeStyle: "short" },
      ),
    });
  }

  if (reservation.guestRegistrationCompletedAt) {
    entries.push({
      id: `${reservation.id}-registration-done`,
      kind: "GUEST_REGISTRATION",
      title: "Registro completado",
      content: "Los huéspedes completaron el formulario de registro.",
      senderName: reservation.guestName,
      createdAt: reservation.guestRegistrationCompletedAt,
      createdAtFormatted: formatDateTime(
        reservation.guestRegistrationCompletedAt,
        "—",
        { dateStyle: "medium", timeStyle: "short" },
      ),
    });
  }

  return entries;
}

function mapActivityRows(rows: ReservationActivityRow[]): TimelineEntry[] {
  return rows.map((row) => ({
    id: row.id,
    kind: row.activityType,
    title: resolveReservationActivityDisplayTitle({
      title: row.title,
      metadata: row.metadata,
    }),
    content: row.content,
    senderName: row.senderName,
    createdAt: row.createdAt,
    createdAtFormatted: row.createdAtFormatted,
    metadata: row.metadata,
  }));
}

function mergeTimelineEntries(
  reservation: ReservationDetailItem,
  activities: ReservationActivityRow[],
): TimelineEntry[] {
  const merged = [
    ...buildSyntheticTimelineEntries(reservation),
    ...mapActivityRows(activities),
  ];
  return merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function entryAccent(kind: TimelineEntry["kind"], title: string, metadata?: unknown) {
  const isInquiry =
    title === "Consulta" ||
    isInquiryActivityMetadata(metadata) ||
    (kind === "AIRBNB_MESSAGE" && title === "Consulta");
  if (kind === "MODIFICATION_REQUEST") {
    return {
      dot: "border-amber-400 bg-amber-50 text-amber-700",
      card: "border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20",
    };
  }
  if (kind === "MODIFICATION_APPROVED") {
    return {
      dot: "border-emerald-400 bg-emerald-50 text-emerald-700",
      card: "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    };
  }
  if (kind === "AIRBNB_MESSAGE" && isInquiry) {
    return {
      dot: "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
      card: "border-sky-200/70 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20",
    };
  }
  if (kind === "AIRBNB_MESSAGE") {
    return {
      dot: "border-primary/40 bg-primary/10 text-primary",
      card: "border-border/70 bg-muted/20",
    };
  }
  return {
    dot: "border-border bg-card text-muted-foreground",
    card: "border-border/60 bg-card",
  };
}

function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const dates = readMetadataDates(entry.metadata);
  const isInquiry =
    entry.title === "Consulta" || isInquiryActivityMetadata(entry.metadata);
  const isMessage = entry.kind === "AIRBNB_MESSAGE" && !isInquiry;
  const accent = entryAccent(entry.kind, entry.title, entry.metadata);
  const messageBody = isMessage
    ? resolveGuestMessageForDisplay(entry.content, { guestName: entry.senderName })
    : null;

  return (
    <li className="relative grid grid-cols-[28px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border shadow-pragma-soft",
            accent.dot,
          )}
        >
          {entry.kind === "MODIFICATION_REQUEST" ? (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          ) : entry.kind === "MODIFICATION_APPROVED" ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : entry.kind === "AIRBNB_MESSAGE" && isInquiry ? (
            <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
          ) : entry.kind === "AIRBNB_MESSAGE" ? (
            <Mail className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Circle className="h-3 w-3 fill-current" aria-hidden />
          )}
        </span>
        {!isLast ? (
          <span className="mt-1 w-px flex-1 bg-border/70" aria-hidden />
        ) : null}
      </div>

      <article className={cn("mb-5 rounded-xl border px-3 py-2.5", accent.card)}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-semibold text-foreground">{entry.title}</p>
          <time
            className="text-[11px] tabular-nums text-muted-foreground"
            dateTime={entry.createdAt}
          >
            {entry.createdAtFormatted}
          </time>
        </div>

        {entry.senderName ? (
          <p className="mt-1 text-xs font-medium text-foreground/85">
            {entry.senderName}
          </p>
        ) : null}

        {isMessage ? (
          <blockquote className="mt-2 border-l-2 border-primary/30 pl-3 text-sm italic leading-relaxed text-foreground/90">
            &ldquo;{messageBody ?? "Mensaje del huésped (texto no legible en el correo)."}&rdquo;
          </blockquote>
        ) : isInquiry ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{entry.content}</p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {entry.content}
          </p>
        )}

        {entry.kind === "MODIFICATION_REQUEST" &&
        (dates.original || dates.requested) ? (
          <div className="mt-3 grid gap-1.5 text-xs text-foreground/85">
            {dates.original ? (
              <p>
                <span className="font-semibold">Original:</span> {dates.original}
              </p>
            ) : null}
            {dates.requested ? (
              <p>
                <span className="font-semibold">Solicitado:</span> {dates.requested}
              </p>
            ) : null}
          </div>
        ) : null}
      </article>
    </li>
  );
}

type ReservationActivityTimelineProps = {
  reservation: ReservationDetailItem;
  activities: ReservationActivityRow[];
  loading?: boolean;
};

export function ReservationActivityTimeline({
  reservation,
  activities,
  loading = false,
}: ReservationActivityTimelineProps) {
  const entries = mergeTimelineEntries(reservation, activities);

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Cargando actividad…
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aún no hay actividad registrada. Los correos Airbnb relacionados
        aparecerán aquí automáticamente.
      </p>
    );
  }

  return (
    <ol className="pt-1">
      {entries.map((entry, index) => (
        <TimelineItem
          key={entry.id}
          entry={entry}
          isLast={index === entries.length - 1}
        />
      ))}
    </ol>
  );
}
