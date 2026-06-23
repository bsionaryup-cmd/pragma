"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PRIORITY_BADGE_CLASS,
  PRIORITY_LABELS,
} from "@/lib/prospecting/prospecting-score";
import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";
import {
  PROSPECTING_FIT_LABELS,
  PROSPECTING_STATUS_LABELS,
} from "@/services/prospecting/prospecting-crm.types";

type ProspectingLeadCardProps = {
  lead: ProspectingLeadRow;
  busy?: boolean;
  onOpen: (lead: ProspectingLeadRow) => void;
  onQuickContact: (lead: ProspectingLeadRow) => void;
};

function formatShortDate(value: string | null): string {
  if (!value) return "Sin contacto";
  return new Date(value).toLocaleDateString("es-CO", {
    month: "short",
    day: "numeric",
  });
}

function websiteHost(website: string | null): string | null {
  if (!website?.trim()) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return website.slice(0, 32);
  }
}

export function ProspectingLeadCard({
  lead,
  busy = false,
  onOpen,
  onQuickContact,
}: ProspectingLeadCardProps) {
  const host = websiteHost(lead.website);
  const canContact = Boolean(lead.phone?.trim());

  return (
    <article
      className="rounded-xl border border-border bg-card p-4 shadow-pragma-soft transition-colors hover:border-primary/30"
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onOpen(lead)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
              {lead.businessName}
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {lead.phone ?? "Sin teléfono"}
              {host ? ` · ${host}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant="outline" className={PRIORITY_BADGE_CLASS[lead.priority]}>
              {lead.priority}
            </Badge>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {lead.prospectingScore}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Badge variant="secondary" className="font-normal">
            {PROSPECTING_STATUS_LABELS[lead.status]}
          </Badge>
          {lead.potentialPragmaFit ? (
            <Badge variant="outline" className="font-normal">
              Fit {PROSPECTING_FIT_LABELS[lead.potentialPragmaFit]}
            </Badge>
          ) : null}
          <span className="text-muted-foreground">
            Último: {formatShortDate(lead.lastContactDate)}
          </span>
        </div>
      </button>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 gap-1.5"
          disabled={busy || !canContact}
          onClick={(event) => {
            event.stopPropagation();
            onQuickContact(lead);
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Contactar
        </Button>
        {lead.website ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              const href = lead.website!.startsWith("http")
                ? lead.website!
                : `https://${lead.website}`;
              window.open(href, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </article>
  );
}
