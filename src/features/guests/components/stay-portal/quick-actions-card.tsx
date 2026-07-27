"use client";

import { MapPin, MessageCircle, Phone, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickActionsCardProps = {
  mapsUrl: string | null;
  whatsappUrl: string | null;
  telUrl: string | null;
  hasWifi: boolean;
};

type ActionItem = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  accent?: "blue" | "green";
};

export function QuickActionsCard({
  mapsUrl,
  whatsappUrl,
  telUrl,
  hasWifi,
}: QuickActionsCardProps) {
  const actions: ActionItem[] = [
    mapsUrl
      ? {
          key: "maps",
          title: "Abrir mapa",
          subtitle: "Cómo llegar",
          icon: <MapPin className="h-5 w-5" />,
          href: mapsUrl,
          external: true,
          accent: "blue" as const,
        }
      : null,
    hasWifi
      ? {
          key: "wifi",
          title: "WiFi",
          subtitle: "Ver contraseña",
          icon: <Wifi className="h-5 w-5" />,
          onClick: () => {
            document
              .getElementById("stay-wifi")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          accent: "blue" as const,
        }
      : null,
    whatsappUrl
      ? {
          key: "whatsapp",
          title: "WhatsApp",
          subtitle: "Recepción",
          icon: <MessageCircle className="h-5 w-5" />,
          href: whatsappUrl,
          external: true,
          accent: "green" as const,
        }
      : null,
    telUrl
      ? {
          key: "call",
          title: "Llamar",
          subtitle: "Recepción",
          icon: <Phone className="h-5 w-5" />,
          href: telUrl,
          accent: "blue" as const,
        }
      : null,
  ].filter(Boolean) as ActionItem[];

  if (actions.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Acciones rápidas">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        Acciones rápidas
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {actions.map((action) => {
          const content = (
            <>
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  action.accent === "green"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-primary/10 text-primary",
                )}
                aria-hidden
              >
                {action.icon}
              </span>
              <span className="mt-2 text-sm font-semibold text-foreground">
                {action.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {action.subtitle}
              </span>
            </>
          );

          const className = cn(
            "flex min-h-[108px] flex-col items-center justify-center rounded-2xl border border-border bg-card px-3 py-4 text-center shadow-pragma-soft transition-colors",
            "hover:border-primary/30 hover:bg-primary/[0.03] active:scale-[0.99]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          );

          if (action.href) {
            return (
              <a
                key={action.key}
                href={action.href}
                className={className}
                {...(action.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={action.key}
              type="button"
              className={className}
              onClick={action.onClick}
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
