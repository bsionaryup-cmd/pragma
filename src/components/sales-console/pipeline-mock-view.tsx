"use client";

import Link from "next/link";
import { MOCK_PROSPECTS } from "@/features/sales-console/data/mock-prospects";
import {
  PIPELINE_COLUMN_STATUSES,
  formatProspectStatus,
  getIcpTier,
  getIcpTierLabel,
  type MockProspect,
  type ProspectStatus,
} from "@/features/sales-console/types/prospect";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function PipelineCard({ prospect }: { prospect: MockProspect }) {
  const tier = getIcpTier(prospect.score);
  const href = `/owner-dashboard/sales/research?prospect=${prospect.id}`;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border/80 bg-background p-3 transition-colors hover:border-pragma-electric/30 hover:bg-muted/20"
    >
      <p className="truncate text-sm font-medium text-foreground">{prospect.companyName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">
          {prospect.estimatedProperties ?? "—"} prop.
        </span>
        {prospect.score != null ? (
          <span className="text-xs font-medium tabular-nums text-foreground">
            {prospect.score}
          </span>
        ) : null}
        {tier ? (
          <Badge className="border-0 bg-pragma-electric/10 text-pragma-electric">
            {getIcpTierLabel(tier)}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}

function PipelineColumn({ status }: { status: ProspectStatus }) {
  const items = MOCK_PROSPECTS.filter((prospect) => prospect.status === status);

  return (
    <div className="flex min-w-[200px] flex-1 flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {formatProspectStatus(status)}
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Vacío</p>
        ) : (
          items.map((prospect) => <PipelineCard key={prospect.id} prospect={prospect} />)
        )}
      </div>
    </div>
  );
}

export function PipelineMockView() {
  return (
    <div className="mt-4">
      <p className="mb-4 text-sm text-muted-foreground">
        Vista previa del embudo · Calificado y Perdido solo aparecen en Prospectos.
      </p>
      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {PIPELINE_COLUMN_STATUSES.map((status) => (
          <PipelineColumn key={status} status={status} />
        ))}
      </div>
    </div>
  );
}
