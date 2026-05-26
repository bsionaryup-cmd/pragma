"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Copy, CopyPlus, CreditCard, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  cancelPaymentLinkAction,
  duplicatePaymentLinkAction,
  issuePaymentLinkAction,
} from "@/features/payments/actions/guest-payment.actions";
import { PaymentLinkCreateForm } from "@/features/payments/components/payment-link-create-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { guestPaymentLinkStatusLabel } from "@/lib/payments/guest-payment-link-labels";
import { formatMoney } from "@/lib/format-currency";
import { PropertyIdentity } from "@/components/properties/property-identity";
import type { GuestPaymentLink } from "@prisma/client";
import { Button } from "@/components/ui/button";

type LinkWithRelations = GuestPaymentLink & {
  reservation: {
    id: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
  } | null;
  property: { id: string; name: string; unitNumber: string | null } | null;
};

export function PaymentLinksHub({
  initialLinks,
  canWrite,
}: {
  initialLinks: LinkWithRelations[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  }

  function issue(linkId: string) {
    startTransition(async () => {
      const result = await issuePaymentLinkAction(linkId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace emitido");
      refresh();
    });
  }

  function duplicate(linkId: string) {
    startTransition(async () => {
      const result = await duplicatePaymentLinkAction(linkId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace duplicado (borrador)");
      refresh();
    });
  }

  function cancel(linkId: string) {
    startTransition(async () => {
      const result = await cancelPaymentLinkAction(linkId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Enlace cancelado");
      refresh();
    });
  }

  const whatsappShare = (url: string, label: string) => {
    const text = encodeURIComponent(`Hola, tu enlace de pago PRAGMA: ${label}\n${url}`);
    return `https://wa.me/?text=${text}`;
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Finanzas"
        title="Payment Links"
        description="Enlaces de cobro por tenant (Wompi del anfitrión). Separado de la suscripción SaaS de PRAGMA."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/payment-history"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              Historial
            </Link>
            <Link
              href="/integrations/wompi"
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              Configurar Wompi
            </Link>
          </div>
        }
      />

      {canWrite ? <PaymentLinkCreateForm /> : null}

      <SectionCard
        title="Enlaces"
        description="Estados: borrador → enviado → pagado. Sin proyecciones ni cobros duplicados."
        className="mt-6"
      >
        {initialLinks.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Aún no hay Payment Links. Crea uno arriba o desde el detalle de una reserva.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {initialLinks.map((link) => (
              <li
                key={link.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-pragma-electric" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {link.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {link.category} · {guestPaymentLinkStatusLabel(link.status)}
                      {link.reservation
                        ? ` · ${link.reservation.guestName}`
                        : null}
                    </p>
                    {link.property ? (
                      <div className="mt-1">
                        <PropertyIdentity
                          name={link.property.name}
                          unitNumber={link.property.unitNumber}
                          size="sm"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <p className="w-full text-sm font-semibold text-foreground sm:w-auto sm:text-end">
                    {formatMoney(Number(link.amount), link.currency)}
                  </p>
                  {link.wompiCheckoutUrl ? (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border border-border p-2 hover:bg-muted"
                        onClick={() => copyUrl(link.wompiCheckoutUrl!)}
                        aria-label="Copiar"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={link.wompiCheckoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border p-2 hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={whatsappShare(link.wompiCheckoutUrl, link.description)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        WhatsApp
                      </a>
                    </>
                  ) : canWrite && link.status === "DRAFT" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="brand"
                      disabled={pending}
                      onClick={() => issue(link.id)}
                    >
                      Emitir
                    </Button>
                  ) : null}
                  {canWrite && link.status !== "PAID" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-border p-2 hover:bg-muted"
                      disabled={pending}
                      onClick={() => duplicate(link.id)}
                      aria-label="Duplicar"
                    >
                      <CopyPlus className="h-4 w-4" />
                    </button>
                  ) : null}
                  {canWrite &&
                  link.status !== "PAID" &&
                  link.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-danger"
                      disabled={pending}
                      onClick={() => cancel(link.id)}
                      aria-label="Cancelar"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
