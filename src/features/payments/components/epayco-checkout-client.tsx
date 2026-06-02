"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { GuestEpaycoCheckoutSession } from "@/services/payments/guest-epayco-checkout.service";
import { Button } from "@/components/ui/button";

type EpaycoCheckoutHandler = {
  open: (config: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    ePayco?: {
      checkout: {
        configure: (config: { key: string; test: boolean }) => EpaycoCheckoutHandler;
      };
    };
  }
}

export function EpaycoCheckoutClient({
  linkId,
}: {
  linkId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<GuestEpaycoCheckoutSession | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch(`/api/payments/epayco/session/${encodeURIComponent(linkId)}`);
        const payload = (await response.json()) as GuestEpaycoCheckoutSession & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo cargar el checkout");
        }
        if (!cancelled) setSession(payload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar pago");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [linkId]);

  useEffect(() => {
    if (document.getElementById("epayco-checkout-script")) {
      setScriptReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "epayco-checkout-script";
    script.src = "https://checkout.epayco.co/checkout.js";
    script.async = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => setError("No se pudo cargar el checkout de ePayco");
    document.body.appendChild(script);
  }, []);

  function openCheckout() {
    if (!session || !window.ePayco?.checkout) {
      setError("Checkout ePayco no disponible");
      return;
    }

    const handler = window.ePayco.checkout.configure({
      key: session.publicKey,
      test: session.test,
    });

    handler.open({
      name: session.name,
      description: session.description,
      invoice: session.invoice,
      currency: session.currency,
      amount: session.amount,
      tax_base: session.amountBase,
      tax: session.tax,
      country: session.country,
      external: session.external,
      response: session.response,
      confirmation: session.confirmation,
      email_billing: session.emailBilling,
      name_billing: session.nameBilling,
      methodsDisable: ["SP", "CASH", "DP"],
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparando pago seguro…
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-4 py-6 text-center">
      <p className="text-sm text-muted-foreground">
        Serás redirigido al checkout seguro de ePayco para completar el pago.
      </p>
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={!scriptReady || !session}
        onClick={openCheckout}
      >
        Pagar con ePayco
      </Button>
    </div>
  );
}
