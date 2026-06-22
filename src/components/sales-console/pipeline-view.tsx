"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import {
  PIPELINE_COLUMN_STATUSES,
  formatProspectStatus,
  pipelineColumnStatusForProspect,
  type ProspectRow,
  type ProspectStatus,
} from "@/features/sales-console/types/prospect";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PipelineViewProps = {
  prospects: ProspectRow[];
};

function PipelineCard({ prospect }: { prospect: ProspectRow }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background p-3">
      <p className="truncate text-sm font-medium text-foreground">{prospect.companyName}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {prospect.city ?? "—"}
        {prospect.phone ? ` · ${prospect.phone}` : ""}
      </p>
    </div>
  );
}

function PipelineColumn({
  status,
  prospects,
}: {
  status: ProspectStatus;
  prospects: ProspectRow[];
}) {
  const items = prospects.filter(
    (prospect) => pipelineColumnStatusForProspect(prospect.status) === status,
  );

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

export function PipelineView({ prospects }: PipelineViewProps) {
  const activeProspects = prospects.filter((prospect) => !prospect.archived);

  if (activeProspects.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border bg-card px-4 py-8">
        <EmptyState
          icon={Users}
          branded={false}
          title="Sin prospectos."
          description="Sin prospectos. Importa empresas o genera prospectos para comenzar."
        />
        <div className="mt-4 flex justify-center">
          <Button asChild>
            <Link href="/owner-dashboard/sales/prospects">Ir a Prospectos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-4 text-sm text-muted-foreground">
        {activeProspects.length} prospecto{activeProspects.length === 1 ? "" : "s"} activo
        {activeProspects.length === 1 ? "" : "s"} · datos reales desde la base de datos
      </p>
      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {PIPELINE_COLUMN_STATUSES.map((status) => (
          <PipelineColumn key={status} status={status} prospects={activeProspects} />
        ))}
      </div>
    </div>
  );
}
