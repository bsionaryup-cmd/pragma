import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { formatMobilityAllyType } from "@/features/qr-mobility/types/ally";
import { getMobilityAllyByToken } from "@/modules/qr-mobility/services/mobility-ally.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MobilityPublicPageProps = {
  params: Promise<{ token: string }>;
};

export default async function MobilityPublicPage({ params }: MobilityPublicPageProps) {
  const { token } = await params;
  const ally = await getMobilityAllyByToken(token);

  if (!ally) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
          <GuestBrandMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Link no disponible</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Este código QR no está activo o ya no existe.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 text-center shadow-pragma-soft">
        <GuestBrandMark />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          PRAGMA Mobility
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{ally.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatMobilityAllyType(ally.type)}
          {ally.company ? ` · ${ally.company}` : ""}
        </p>
        {ally.qrImageDataUrl ? (
          <img
            src={ally.qrImageDataUrl}
            alt={`QR de ${ally.name}`}
            className="mx-auto mt-6 h-40 w-40 rounded-xl border border-border bg-white p-3"
          />
        ) : null}
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          Portal de movilidad — reservas disponibles en una próxima fase.
        </p>
      </section>
    </main>
  );
}
