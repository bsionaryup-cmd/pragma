import { EpaycoCheckoutClient } from "@/features/payments/components/epayco-checkout-client";

export default async function BillingEpaycoCheckoutPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
        <header className="mb-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            PRAGMA · Suscripción
          </p>
          <h1 className="font-heading mt-2 text-xl font-semibold">Pago con ePayco</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Activa o renueva tu suscripción PRAGMA de forma segura.
          </p>
        </header>
        <EpaycoCheckoutClient
          sessionPath={`/api/payments/epayco/session/billing/${encodeURIComponent(invoiceId)}`}
        />
      </section>
    </main>
  );
}
