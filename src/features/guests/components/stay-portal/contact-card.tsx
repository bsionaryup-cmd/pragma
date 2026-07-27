import { Headset, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type ContactCardProps = {
  contactName: string | null;
  whatsappUrl: string | null;
  telUrl: string | null;
};

export function ContactCard({
  contactName,
  whatsappUrl,
  telUrl,
}: ContactCardProps) {
  if (!whatsappUrl && !telUrl) return null;

  return (
    <section
      aria-labelledby="stay-contact-title"
      className="rounded-2xl border border-border bg-card p-4 shadow-pragma-soft sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
            aria-hidden
          >
            <Headset className="h-5 w-5" />
          </span>
          <div>
            <h2
              id="stay-contact-title"
              className="text-base font-semibold text-foreground"
            >
              ¿Necesitas ayuda?
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {contactName
                ? `${contactName} puede ayudarte.`
                : "Recepción puede ayudarte."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {whatsappUrl ? (
            <Button
              asChild
              className="h-11 rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          ) : null}
          {telUrl ? (
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl border-2 border-primary px-5 font-semibold text-primary hover:bg-primary/5"
            >
              <a href={telUrl}>
                <Phone className="h-4 w-4" />
                Llamar
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
