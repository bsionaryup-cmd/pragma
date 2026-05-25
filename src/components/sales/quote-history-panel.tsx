"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cancelSalesQuoteAction,
  issueSalesQuoteOfferAction,
} from "@/features/sales/actions/sales.actions";
import { formatCop, getPlanDefinition } from "@/modules/billing/domain/plan-catalog";
import { formatDate } from "@/lib/helpers/date";
import { Button } from "@/components/ui/button";

type QuoteRow = {
  id: string;
  status: string;
  plan: string;
  propertyCount: number;
  prospectName: string | null;
  prospectEmail: string | null;
  finalAmountCop: unknown;
  savingsAmountCop: unknown;
  offerToken: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: { email: string };
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  ACCEPTED: "Aceptada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  CONVERTED: "Convertida",
};

export function QuoteHistoryPanel({ quotes }: { quotes: QuoteRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function copyOffer(quoteId: string) {
    startTransition(async () => {
      const result = await issueSalesQuoteOfferAction(quoteId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      await navigator.clipboard.writeText(result.offerUrl);
      toast.success("Enlace copiado");
    });
  }

  function cancel(quoteId: string) {
    startTransition(async () => {
      await cancelSalesQuoteAction(quoteId);
      toast.success("Cotización cancelada");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-heading text-lg font-semibold">Quote History & Audit</h2>
        <p className="text-xs text-muted-foreground">
          PRAGMA Operations · historial de cotizaciones SaaS
        </p>
      </div>
      {quotes.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Sin cotizaciones.</p>
      ) : (
        <ul className="divide-y divide-border">
          {quotes.map((q) => (
            <li
              key={q.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {getPlanDefinition(q.plan as "STARTER").name} · {q.propertyCount}{" "}
                  props · {STATUS_LABEL[q.status] ?? q.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  {q.prospectName ?? "—"} · {q.prospectEmail ?? "—"} ·{" "}
                  {formatCop(Number(q.finalAmountCop))}/mes · ahorro{" "}
                  {formatCop(Number(q.savingsAmountCop))}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(q.createdAt)} · {q.createdBy.email}
                  {q.expiresAt ? ` · expira ${formatDate(q.expiresAt)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {q.offerToken ? (
                  <Link
                    href={`/offer/${q.offerToken}`}
                    className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                    target="_blank"
                  >
                    Ver oferta
                  </Link>
                ) : null}
                {q.status !== "CANCELLED" && q.status !== "CONVERTED" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => copyOffer(q.id)}
                    >
                      Copiar link
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => cancel(q.id)}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
