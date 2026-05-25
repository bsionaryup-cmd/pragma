"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { acceptPublicOfferAction } from "@/features/sales/actions/sales.actions";
import {
  formatCop,
  getPlanDefinition,
  PLAN_CATALOG,
} from "@/modules/billing/domain/plan-catalog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/helpers/date";
import type { SalesQuote } from "@prisma/client";

type PublicOfferViewProps = {
  quote: SalesQuote;
  token: string;
};

export function PublicOfferView({ quote, token }: PublicOfferViewProps) {
  const [email, setEmail] = useState(quote.prospectEmail ?? "");
  const [pending, startTransition] = useTransition();
  const plan = getPlanDefinition(quote.plan);
  const features = PLAN_CATALOG[quote.plan].features;

  const expired =
    quote.status === "EXPIRED" ||
    quote.status === "CANCELLED" ||
    (quote.expiresAt != null && quote.expiresAt < new Date());

  function accept() {
    startTransition(async () => {
      const result = await acceptPublicOfferAction(token, email);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Oferta aceptada — continúa con tu registro");
      window.location.href = `/sign-up?offer_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    });
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-pragma-navy via-background to-background px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
            PRAGMA · Oferta privada
          </p>
          <h1 className="font-heading mt-2 text-3xl font-semibold text-foreground">
            Plan {plan.name}
          </h1>
          {quote.prospectName ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Para {quote.prospectName}
            </p>
          ) : null}
        </div>

        <div className="mt-8 rounded-2xl border border-border/80 bg-card p-6 shadow-pragma-card">
          {expired ? (
            <p className="text-center text-sm text-danger">
              Esta oferta ya no está disponible.
            </p>
          ) : (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Propiedades</dt>
                  <dd className="font-medium">{quote.propertyCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Precio base</dt>
                  <dd>{formatCop(Number(quote.listAmountCop))}/mes</dd>
                </div>
                <div className="flex justify-between text-pragma-electric">
                  <dt>Ahorro</dt>
                  <dd>−{formatCop(Number(quote.savingsAmountCop))}</dd>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between">
                    <dt className="font-medium">Precio final</dt>
                    <dd className="text-xl font-bold">
                      {formatCop(Number(quote.finalAmountCop))}/mes
                    </dd>
                  </div>
                </div>
                {quote.expiresAt ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Válida hasta {formatDate(quote.expiresAt)}
                  </p>
                ) : null}
              </dl>

              <ul className="mt-6 space-y-2">
                {features.slice(0, 5).map((f) => (
                  <li key={f} className="flex gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-pragma-electric" />
                    {f}
                  </li>
                ))}
              </ul>

              <label className="mt-6 block text-sm">
                Tu correo
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <Button
                type="button"
                variant="brand"
                className="mt-4 w-full"
                disabled={pending || quote.status === "CONVERTED"}
                onClick={accept}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Aceptar oferta y crear cuenta
              </Button>

              {quote.status === "CONVERTED" ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Oferta ya utilizada.{" "}
                  <Link href="/sign-in" className="text-pragma-electric underline">
                    Iniciar sesión
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
