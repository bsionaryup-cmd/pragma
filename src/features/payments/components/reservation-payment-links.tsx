"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelPaymentLinkAction,
  createReservationPaymentLinkAction,
  getReservationPaymentBalanceAction,
  listReservationPaymentLinksAction,
} from "@/features/payments/actions/guest-payment.actions";
import { guestPaymentLinkStatusLabel } from "@/lib/payments/guest-payment-link-labels";
import { PaymentChargeDialog } from "@/components/payments/payment-charge-dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-currency";
import type { SerializedGuestPaymentLink } from "@/lib/payments/guest-payment-link-serializer";
import { cn } from "@/lib/utils";

type ReservationPaymentLinksProps = {
  reservationId: string;
};

export function ReservationPaymentLinks({ reservationId }: ReservationPaymentLinksProps) {
  const [pending, startTransition] = useTransition();
  const [chargeOpen, setChargeOpen] = useState(false);
  const [balance, setBalance] = useState<{
    totalAmount: number;
    paidAmount: number;
    remainingBalance: number;
    currency: string;
    guestName: string;
  } | null>(null);
  const [links, setLinks] = useState<SerializedGuestPaymentLink[]>([]);

  function refresh() {
    startTransition(async () => {
      const [balRes, linksRes] = await Promise.all([
        getReservationPaymentBalanceAction(reservationId),
        listReservationPaymentLinksAction(reservationId),
      ]);
      if (balRes.success) setBalance(balRes.balance);
      if (linksRes.success) setLinks(linksRes.links);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  function issue(mode: "full" | "deposit_50") {
    startTransition(async () => {
      const result = await createReservationPaymentLinkAction({
        reservationId,
        mode,
        issue: true,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace listo para compartir");
      refresh();
    });
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  }

  function cancelLink(linkId: string) {
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

  const hasBalance = Boolean(balance?.remainingBalance && balance.remainingBalance > 0);

  return (
    <>
      <div className="space-y-3">
        {balance ? (
          <p className="text-sm text-foreground">
            <span className="font-semibold tabular-nums">
              {formatMoney(balance.remainingBalance, balance.currency)}
            </span>{" "}
            <span className="text-muted-foreground">pendiente de</span>{" "}
            <span className="font-medium tabular-nums">
              {formatMoney(balance.totalAmount, balance.currency)}
            </span>
            {balance.paidAmount > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                · pagado {formatMoney(balance.paidAmount, balance.currency)}
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="brand"
            className="h-8 text-xs"
            disabled={pending || !hasBalance}
            onClick={() => issue("full")}
          >
            Generar enlace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !hasBalance}
            onClick={() => issue("deposit_50")}
          >
            Depósito 50%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !hasBalance}
            onClick={() => setChargeOpen(true)}
          >
            Otro monto
          </Button>
        </div>

        {links.length > 0 ? (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
            {links.map((link) => {
              const canCancel = link.status !== "PAID" && link.status !== "CANCELLED";

              return (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {formatMoney(link.amount, link.currency)}
                    </p>
                    <p className="text-muted-foreground">
                      {guestPaymentLinkStatusLabel(link.status)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {link.wompiCheckoutUrl ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[11px] font-medium hover:bg-muted/50"
                          onClick={() => copyUrl(link.wompiCheckoutUrl!)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copiar
                        </button>
                        <a
                          href={link.wompiCheckoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[11px] font-medium hover:bg-muted/50"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Abrir
                        </a>
                      </>
                    ) : null}
                    {canCancel ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border",
                          "text-muted-foreground hover:bg-muted/50 hover:text-danger",
                        )}
                        onClick={() => cancelLink(link.id)}
                        disabled={pending}
                        aria-label="Cancelar enlace"
                        title="Cancelar"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin enlaces emitidos.</p>
        )}
      </div>

      <PaymentChargeDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        title="Cobro personalizado"
        description="El monto no puede superar el saldo pendiente."
        currency={balance?.currency ?? "COP"}
        maxAmount={balance?.remainingBalance}
        pending={pending}
        onConfirm={(customAmount) => {
          startTransition(async () => {
            const result = await createReservationPaymentLinkAction({
              reservationId,
              mode: "custom",
              customAmount,
              category: "EXTRA_SERVICES",
              description: `Cargo adicional · ${balance?.guestName ?? "huésped"}`,
              issue: true,
            });
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success("Enlace generado");
            setChargeOpen(false);
            refresh();
          });
        }}
      />
    </>
  );
}
