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
};

const POLL_MS = 3000;
const MAX_POLLS = 20;

export function BillingCheckoutFeedback({
  paid = false,
  paymentReference,
  epaycoResponseCode,
}: BillingCheckoutFeedbackProps) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!paid || started.current) return;
    started.current = true;

    toast.message("Confirmando pago…", { duration: 5000 });
    router.replace("/settings/billing");

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void reconcileBillingPaymentReturnAction({
        reference: paymentReference,
        epaycoResponseCode,
      }).then(() =>
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
  }, [paid, paymentReference, epaycoResponseCode, router]);

  return null;
}
