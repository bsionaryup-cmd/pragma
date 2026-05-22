"use client";

import { useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmManualPaymentAction } from "@/features/billing/actions/billing.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ManualPaymentVerifyPanelProps = {
  invoiceId: string;
  manualRef: string | null;
  submittedAt: string | null;
};

export function ManualPaymentVerifyPanel({
  invoiceId,
  manualRef,
  submittedAt,
}: ManualPaymentVerifyPanelProps) {
  const [pending, startTransition] = useTransition();

  if (!manualRef) return null;

  const onConfirm = () => {
    if (!window.confirm("¿Confirmar pago manual y activar suscripción?")) return;
    startTransition(async () => {
      const result = await confirmManualPaymentAction(invoiceId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
          <ShieldCheck className="h-4 w-4" />
          Verificación manual pendiente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-amber-950">
        <p>
          Comprobante: <span className="font-mono font-medium">{manualRef}</span>
          {submittedAt ? (
            <span className="text-amber-800">
              {" "}
              · enviado {new Date(submittedAt).toLocaleDateString("es-CO")}
            </span>
          ) : null}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={onConfirm}
          className="bg-amber-800 hover:bg-amber-900"
        >
          Confirmar pago y activar
        </Button>
      </CardContent>
    </Card>
  );
}
