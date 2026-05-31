"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createReservationManualPaymentAction,
  getOrganizationPaymentMethodsAction,
  listReservationManualPaymentsAction,
} from "@/features/payments/actions/reservation-manual-payment.actions";
import {
  getReservationPaymentBalanceAction,
} from "@/features/payments/actions/guest-payment.actions";
import { ReservationPaymentLinks } from "@/features/payments/components/reservation-payment-links";
import type { OrganizationPaymentMethod } from "@/lib/payments/organization-payment-methods-types";
import type { SerializedReservationPayment } from "@/lib/payments/organization-payment-methods-types";
import { formatMoney } from "@/lib/format-currency";
import { formatDateTime } from "@/lib/helpers/date";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ManualPaymentMethod = "CASH" | "BANK_TRANSFER" | "OTHER";

const MANUAL_PAYMENT_METHOD = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  OTHER: "OTHER",
} as const satisfies Record<string, ManualPaymentMethod>;

type ReservationPaymentsPanelProps = {
  reservationId: string;
  canManagePayments: boolean;
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export function ReservationPaymentsPanel({
  reservationId,
  canManagePayments,
}: ReservationPaymentsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [balance, setBalance] = useState<{
    totalAmount: number;
    paidAmount: number;
    remainingBalance: number;
    currency: string;
  } | null>(null);
  const [payments, setPayments] = useState<SerializedReservationPayment[]>([]);
  const [orgMethods, setOrgMethods] = useState<OrganizationPaymentMethod[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>(
    MANUAL_PAYMENT_METHOD.CASH,
  );
  const [accountMethodId, setAccountMethodId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayDateKey());
  const [notes, setNotes] = useState("");

  const bankAccounts = orgMethods.filter(
    (item) => item.type === "bank_transfer" && item.enabled,
  );
  const cashEnabled = orgMethods.some(
    (item) => item.type === "cash" && item.enabled,
  );
  const otherEnabled = orgMethods.some(
    (item) => item.type === "other" && item.enabled,
  );

  function refresh() {
    startTransition(async () => {
      const [balanceRes, paymentsRes, methodsRes] = await Promise.all([
        getReservationPaymentBalanceAction(reservationId),
        listReservationManualPaymentsAction(reservationId),
        getOrganizationPaymentMethodsAction(),
      ]);
      if (balanceRes.success) setBalance(balanceRes.balance);
      if (paymentsRes.success) setPayments(paymentsRes.payments);
      if (methodsRes.success) setOrgMethods(methodsRes.methods);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  function resetForm() {
    setAmount("");
    setMethod(MANUAL_PAYMENT_METHOD.CASH);
    setAccountMethodId("");
    setPaymentReference("");
    setReceivedAt(todayDateKey());
    setNotes("");
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
  }

  function saveManualPayment() {
    const parsedAmount = Number(amount.replace(/,/g, ""));
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    startTransition(async () => {
      const result = await createReservationManualPaymentAction({
        reservationId,
        amount: parsedAmount,
        method,
        paymentReference: paymentReference.trim() || undefined,
        accountMethodId:
          method === MANUAL_PAYMENT_METHOD.BANK_TRANSFER
            ? accountMethodId
            : undefined,
        receivedAt,
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Pago registrado");
      setModalOpen(false);
      refresh();
    });
  }

  const canAddPayment =
    canManagePayments &&
    Boolean(balance?.remainingBalance && balance.remainingBalance > 0);

  return (
    <div className="space-y-5">
      {balance ? (
        <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between gap-4 py-1">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium tabular-nums">
              {formatMoney(balance.totalAmount, balance.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-1">
            <span className="text-muted-foreground">Pagado</span>
            <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatMoney(balance.paidAmount, balance.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border/60 py-1 pt-2">
            <span className="font-medium">Pendiente</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(balance.remainingBalance, balance.currency)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pagos registrados
          </h5>
          {canAddPayment ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={pending}
              onClick={openModal}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar pago
            </Button>
          ) : null}
        </div>

        {payments.length > 0 ? (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/80">
            {payments.map((payment) => (
              <li key={payment.id} className="space-y-0.5 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {payment.amountFormatted}
                  </p>
                  <span className="text-muted-foreground">{payment.methodLabel}</span>
                </div>
                <p className="text-muted-foreground">
                  {payment.receivedAt}
                  {payment.accountMethodLabel
                    ? ` · ${payment.accountMethodLabel}`
                    : null}
                  {payment.paymentReference
                    ? ` · Ref. ${payment.paymentReference}`
                    : null}
                </p>
                {payment.notes ? (
                  <p className="text-muted-foreground/90">{payment.notes}</p>
                ) : null}
                <p className="text-[11px] text-muted-foreground/80">
                  Registrado {formatDateTime(payment.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sin pagos manuales.</p>
        )}
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Enlaces de pago
        </h5>
        <ReservationPaymentLinks
          reservationId={reservationId}
          hideBalanceSummary
          canManage={canManagePayments}
        />
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago manual</DialogTitle>
            <DialogDescription>
              El monto no puede superar el saldo pendiente. No crea ingreso en finanzas
              automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-amount">Monto ({balance?.currency ?? "COP"})</Label>
              <Input
                id="manual-amount"
                type="number"
                min={1}
                max={balance?.remainingBalance}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={
                  balance?.remainingBalance
                    ? `Máx. ${balance.remainingBalance.toLocaleString()}`
                    : "0"
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-method">Método</Label>
              <select
                id="manual-method"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as ManualPaymentMethod)
                }
              >
                {cashEnabled ? (
                  <option value={MANUAL_PAYMENT_METHOD.CASH}>Efectivo</option>
                ) : null}
                {bankAccounts.length > 0 ? (
                  <option value={MANUAL_PAYMENT_METHOD.BANK_TRANSFER}>
                    Transferencia
                  </option>
                ) : null}
                {otherEnabled ? (
                  <option value={MANUAL_PAYMENT_METHOD.OTHER}>Otro</option>
                ) : null}
              </select>
            </div>

            {method === MANUAL_PAYMENT_METHOD.BANK_TRANSFER ? (
              <div className="space-y-1.5">
                <Label htmlFor="manual-account">Cuenta destino</Label>
                <select
                  id="manual-account"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={accountMethodId}
                  onChange={(event) => setAccountMethodId(event.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label || account.account_holder || "Cuenta bancaria"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="manual-reference">Referencia</Label>
              <Input
                id="manual-reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder="Número de comprobante"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-date">Fecha recibido</Label>
              <Input
                id="manual-date"
                type="date"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-notes">Notas</Label>
              <Textarea
                id="manual-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={pending || !amount}
              onClick={saveManualPayment}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
