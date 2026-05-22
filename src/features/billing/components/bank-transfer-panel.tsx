"use client";

import { useState, useTransition } from "react";
import { Building2, Copy } from "lucide-react";
import { toast } from "sonner";
import { submitManualPaymentAction } from "@/features/billing/actions/billing.actions";
import { BANK_TRANSFER_DETAILS } from "@/modules/billing/domain/bank-transfer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BankTransferPanelProps = {
  invoiceId: string;
  amount: string;
  currency: string;
  referenceHint?: string | null;
  submitted?: boolean;
};

export function BankTransferPanel({
  invoiceId,
  amount,
  currency,
  referenceHint,
  submitted,
}: BankTransferPanelProps) {
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const onSubmit = () => {
    startTransition(async () => {
      const result = await submitManualPaymentAction({
        invoiceId,
        reference,
      });
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Transferencia bancaria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Transfiere{" "}
          <strong className="tabular-nums">
            {Number(amount).toLocaleString("es-CO")} {currency}
          </strong>{" "}
          e indica la referencia del comprobante.
        </p>
        <dl className="space-y-2 rounded-xl border bg-muted/30 p-4 text-xs">
          {[
            ["Banco", BANK_TRANSFER_DETAILS.bankName],
            ["Tipo", BANK_TRANSFER_DETAILS.accountType],
            ["Cuenta", BANK_TRANSFER_DETAILS.accountNumber],
            ["Titular", BANK_TRANSFER_DETAILS.accountHolder],
            ["NIT", BANK_TRANSFER_DETAILS.nit],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="flex items-center gap-1 font-mono font-medium">
                {value}
                <button
                  type="button"
                  onClick={() => copy(String(value))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Copiar ${label}`}
                >
                  <Copy className="h-3 w-3" />
                </button>
              </dd>
            </div>
          ))}
        </dl>

        {submitted && referenceHint ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Comprobante enviado (ref. {referenceHint}). Verificación en 1–2 días hábiles.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="transfer-ref">Referencia del comprobante</Label>
            <Input
              id="transfer-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. 123456789"
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || reference.trim().length < 4}
              onClick={onSubmit}
            >
              Enviar comprobante
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
