"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, ExternalLink, Link2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  createReservationPaymentLinkAction,
  getReservationPaymentBalanceAction,
  listReservationPaymentLinksAction,
} from "@/features/payments/actions/guest-payment.actions";
import { guestPaymentLinkStatusLabel } from "@/lib/payments/guest-payment-link-labels";
import { PaymentChargeDialog } from "@/components/payments/payment-charge-dialog";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-currency";
import type { GuestPaymentLink } from "@prisma/client";

type ReservationPaymentLinksProps = {
  reservationId: string;
  canManage: boolean;
};

export function ReservationPaymentLinks({
  reservationId,
  canManage,
}: ReservationPaymentLinksProps) {
  const [pending, startTransition] = useTransition();
  const [chargeOpen, setChargeOpen] = useState(false);
  const [balance, setBalance] = useState<{
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    remainingBalance: number;
    currency: string;
    guestName: string;
  } | null>(null);
  const [links, setLinks] = useState<GuestPaymentLink[]>([]);

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

  function issue(mode: "full" | "deposit_50" | "remaining") {
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
      toast.success("Payment Link generado");
      refresh();
    });
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  }

  if (!canManage) return null;

  return (
    <>
      <div className="rounded-xl border border-border/80 bg-card px-3 py-3 shadow-pragma-soft">
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-pragma-electric" />
          <h4 className="text-xs font-medium text-muted-foreground">Payment Links</h4>
        </div>

        {balance ? (
          <dl className="mb-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div>
              <dt>Total</dt>
              <dd className="font-medium text-foreground">
                {formatMoney(balance.totalAmount, balance.currency)}
              </dd>
            </div>
            <div>
              <dt>Pagado</dt>
              <dd className="font-medium text-pragma-electric">
                {formatMoney(balance.paidAmount, balance.currency)}
              </dd>
            </div>
            <div>
              <dt>Pendiente (enlaces)</dt>
              <dd>{formatMoney(balance.pendingAmount, balance.currency)}</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd className="font-semibold text-foreground">
                {formatMoney(balance.remainingBalance, balance.currency)}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !balance?.remainingBalance}
            onClick={() => issue("full")}
          >
            Pago total
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !balance?.remainingBalance}
            onClick={() => issue("deposit_50")}
          >
            Depósito 50%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !balance?.remainingBalance}
            onClick={() => issue("remaining")}
          >
            Saldo pendiente
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={pending || !balance?.remainingBalance}
            onClick={() => setChargeOpen(true)}
          >
            Cargo + enlace
          </Button>
        </div>

        {links.length > 0 ? (
          <ul className="space-y-2 border-t border-border/60 pt-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="text-muted-foreground">
                  {guestPaymentLinkStatusLabel(link.status)} ·{" "}
                  {formatMoney(Number(link.amount), link.currency)}
                </span>
                {link.wompiCheckoutUrl ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-muted"
                      onClick={() => copyUrl(link.wompiCheckoutUrl!)}
                      aria-label="Copiar enlace"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={link.wompiCheckoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 hover:bg-muted"
                      aria-label="Abrir enlace"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </span>
                ) : (
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">Sin enlaces emitidos aún.</p>
        )}
      </div>

      <PaymentChargeDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        title="Cargo adicional + Payment Link"
        description="El monto no puede superar el saldo pendiente de la reserva."
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
            toast.success("Cargo + Payment Link generado");
            setChargeOpen(false);
            refresh();
          });
        }}
      />
    </>
  );
}
