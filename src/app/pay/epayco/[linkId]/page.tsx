import { EpaycoCheckoutClient } from "@/features/payments/components/epayco-checkout-client";
import { GuestBrandMark } from "@/components/brand/guest-brand-mark";

export const dynamic = "force-dynamic";

type PayEpaycoPageProps = {
  params: Promise<{ linkId: string }>;
};

export default async function PayEpaycoPage({ params }: PayEpaycoPageProps) {
  const { linkId } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-pragma-soft">
        <GuestBrandMark />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Pago seguro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Procesado por ePayco. No compartas este enlace con terceros.
        </p>
        <EpaycoCheckoutClient linkId={linkId} />
      </section>
    </main>
  );
}
