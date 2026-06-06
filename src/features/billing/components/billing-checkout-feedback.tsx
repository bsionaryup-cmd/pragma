"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getSubscriptionStatusAction,
  reconcileBillingPaymentReturnAction,
} from "@/features/billing/actions/billing.actions";

type BillingCheckoutFeedbackProps = {
  paid?: boolean;
  paymentReference?: string;
  epaycoResponseCode?: string;
  epaycoRefPayco?: string;
};

const POLL_MS = 3000;
const MAX_POLLS = 20;

function readReturnPaymentParams(
  paymentReference?: string,
  epaycoResponseCode?: string,
  epaycoRefPayco?: string,
) {
  if (typeof window === "undefined") {
    return { paymentReference, epaycoResponseCode, epaycoRefPayco };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    paymentReference:
      paymentReference ??
      params.get("ref") ??
      params.get("x_id_invoice") ??
      undefined,
    epaycoResponseCode:
      epaycoResponseCode ??
      params.get("x_cod_response") ??
      params.get("x_cod_respuesta") ??
      undefined,
    epaycoRefPayco:
      epaycoRefPayco ??
      params.get("ref_payco") ??
      params.get("x_ref_payco") ??
      undefined,
  };
}

export function BillingCheckoutFeedback({
  paid = false,
  paymentReference,
  epaycoResponseCode,
  epaycoRefPayco,
}: BillingCheckoutFeedbackProps) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!paid || started.current) return;
    started.current = true;

    toast.message("Confirmando pago…", { duration: 5000 });

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const returnParams = readReturnPaymentParams(
        paymentReference,
        epaycoResponseCode,
        epaycoRefPayco,
      );
      void reconcileBillingPaymentReturnAction(returnParams).then(() =>
        getSubscriptionStatusAction().then((s) => {
          if (s.status === "ACTIVE" && !s.locked) {
            window.clearInterval(timer);
            toast.success("Suscripción activada correctamente");
            router.refresh();
          } else if (attempts >= MAX_POLLS) {
            window.clearInterval(timer);
            toast.info("Pago recibido. Si no se activa en minutos, recarga la página.");
          }
        }),
      );
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [paid, paymentReference, epaycoResponseCode, epaycoRefPayco, router]);

  return null;
}
