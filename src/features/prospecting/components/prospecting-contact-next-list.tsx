"use client";

import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FOLLOW_UP_URGENCY_CLASS,
  FOLLOW_UP_URGENCY_LABELS,
} from "@/lib/prospecting/prospecting-intelligence";
import { PRIORITY_BADGE_CLASS } from "@/lib/prospecting/prospecting-score";
import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";

type ProspectingContactNextListProps = {
  leads: ProspectingLeadRow[];
  busyId: string | null;
  onQuickContact: (lead: ProspectingLeadRow) => void;
  onOpen: (lead: ProspectingLeadRow) => void;
};

export function ProspectingContactNextList({
  leads,
  busyId,
  onQuickContact,
  onOpen,
}: ProspectingContactNextListProps) {
  if (leads.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
        No hay contactos pendientes con teléfono. Busca property managers para llenar la cola.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {leads.map((lead) => (
        <li
          key={lead.id}
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpen(lead)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={PRIORITY_BADGE_CLASS[lead.priority]}>
                {lead.priority}
              </Badge>
              <span className="text-xs font-semibold tabular-nums">{lead.prospectingScore}</span>
              {lead.followUpUrgency ? (
                <Badge
                  variant="outline"
                  className={FOLLOW_UP_URGENCY_CLASS[lead.followUpUrgency]}
                >
                  {FOLLOW_UP_URGENCY_LABELS[lead.followUpUrgency]}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {lead.businessName}
            </p>
            {lead.scoreReasons.length > 0 ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {lead.scoreReasons.slice(0, 2).join(" · ")}
              </p>
            ) : null}
          </button>
          <Button
            type="button"
            size="sm"
            className="w-full shrink-0 gap-1.5 sm:w-auto"
            disabled={busyId === lead.id}
            onClick={() => onQuickContact(lead)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Contactar
          </Button>
        </li>
      ))}
    </ul>
  );
}
