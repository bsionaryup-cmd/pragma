"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Copy, CopyPlus, ExternalLink, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelPaymentLinkAction,
  duplicatePaymentLinkAction,
  issuePaymentLinkAction,
} from "@/features/payments/actions/guest-payment.actions";
import {
  PaymentLinkCreateForm,
  paymentLinkCategoryLabel,
} from "@/features/payments/components/payment-link-create-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { guestPaymentLinkStatusLabel } from "@/lib/payments/guest-payment-link-labels";
import { formatDateTime } from "@/lib/helpers/date";
import { formatMoney } from "@/lib/format-currency";
import { formatPropertyLabel } from "@/lib/property-display";
import { useI18n } from "@/components/providers/i18n-provider";
import type { SerializedGuestPaymentLinkForHub } from "@/lib/payments/guest-payment-link-serializer";
import type { GuestPaymentLinkStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LinkStatusBadge({ status }: { status: GuestPaymentLinkStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "PAID" && "bg-success/15 text-success",
        status === "DRAFT" && "bg-muted text-muted-foreground",
        (status === "SENT" || status === "PENDING" || status === "PROCESSING") &&
          "bg-pragma-electric/10 text-pragma-electric",
        (status === "FAILED" || status === "EXPIRED") && "bg-amber-500/10 text-amber-700",
        (status === "CANCELLED" || status === "REFUNDED") &&
          "bg-muted text-muted-foreground line-through",
      )}
    >
      {guestPaymentLinkStatusLabel(status)}
    </span>
  );
}

function LinkMeta({ link }: { link: SerializedGuestPaymentLinkForHub }) {
  const { t } = useI18n();
  const parts = [
    paymentLinkCategoryLabel(link.category),
    link.reservation?.guestName,
    link.property ? formatPropertyLabel(link.property) : null,
  ].filter(Boolean);

  const timestamps = [
    `${t("payments.createdAt")} ${formatDateTime(link.createdAt)}`,
    link.status === "PAID"
      ? `${t("payments.paidAt")} ${formatDateTime(link.updatedAt)}`
      : null,
  ].filter(Boolean);

  return (
    <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
      {parts.length > 0 ? <p className="truncate">{parts.join(" · ")}</p> : null}
      <p className="truncate tabular-nums">{timestamps.join(" · ")}</p>
    </div>
  );
}

export function PaymentLinksHub({
  initialLinks,
  canWrite,
}: {
  initialLinks: SerializedGuestPaymentLinkForHub[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  }

  function issue(linkId: string) {
    startTransition(async () => {
      const result = await issuePaymentLinkAction(linkId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace emitido");
      refresh();
    });
  }

  function duplicate(linkId: string) {
    startTransition(async () => {
      const result = await duplicatePaymentLinkAction(linkId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace duplicado (borrador)");
      refresh();
    });
  }

  function cancel(linkId: string) {
    startTransition(async () => {
      const result = await cancelPaymentLinkAction(linkId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace cancelado");
      refresh();
    });
  }

  const whatsappShare = (url: string, label: string) => {
    const text = encodeURIComponent(`Hola, tu enlace de pago PRAGMA: ${label}\n${url}`);
    return `https://wa.me/?text=${text}`;
  };

  const activeCount = initialLinks.filter(
    (link) => !["PAID", "CANCELLED", "EXPIRED", "REFUNDED"].includes(link.status),
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t("finance.eyebrow")}
        title={t("payments.linksTitle")}
        description={t("payments.linksDescription")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/payment-history"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("payments.historyShort")}
            </Link>
            <Link
              href="/integrations/wompi"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              Wompi
            </Link>
          </div>
        }
      />

      <SectionCard
        title={t("payments.listTitle")}
        description={
          initialLinks.length > 0
            ? t("payments.listCount", {
                total: initialLinks.length,
                active: activeCount,
              })
            : t("payments.listEmpty")
        }
      >
        {canWrite ? <PaymentLinkCreateForm /> : null}

        {initialLinks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
            {t("payments.listHint")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {initialLinks.map((link) => {
              const canCancel =
                canWrite && link.status !== "PAID" && link.status !== "CANCELLED";
              const canDuplicate = canWrite && link.status !== "PAID";
              const showIssue = canWrite && link.status === "DRAFT";

              return (
                <li
                  key={link.id}
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {link.description}
                      </p>
                      <LinkStatusBadge status={link.status} />
                    </div>
                    <LinkMeta link={link} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <p className="mr-1 text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(link.amount, link.currency)}
                    </p>

                    {link.wompiCheckoutUrl ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => copyUrl(link.wompiCheckoutUrl!)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copiar
                        </Button>
                        <a
                          href={link.wompiCheckoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted/50"
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Abrir
                        </a>
                        <a
                          href={whatsappShare(link.wompiCheckoutUrl, link.description)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted/50"
                        >
                          <MessageCircle className="mr-1 h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </>
                    ) : showIssue ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        className="h-8 text-xs"
                        disabled={pending}
                        onClick={() => issue(link.id)}
                      >
                        Emitir
                      </Button>
                    ) : null}

                    {canDuplicate ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted/50"
                        disabled={pending}
                        onClick={() => duplicate(link.id)}
                        title="Duplicar"
                        aria-label="Duplicar"
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    {canCancel ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/50 hover:text-danger"
                        disabled={pending}
                        onClick={() => cancel(link.id)}
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
