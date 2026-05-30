"use client";

import { CalendarDays, CreditCard, KeyRound, RefreshCw, TrendingUp } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const integrations = [
  { icon: RefreshCw, name: "Airbnb", detail: "Import · sync · iCal" },
  { icon: KeyRound, name: "TTLock", detail: "Smart Access por reserva" },
  { icon: TrendingUp, name: "PriceLabs", detail: "API · tarifas · overrides" },
  { icon: CalendarDays, name: "Calendario", detail: "Multi-propiedad" },
  { icon: CreditCard, name: "Wompi", detail: "Pagos SaaS y huéspedes" },
];

export function LandingIntegrations() {
  return (
    <section id="integrations" className="border-t border-pragma-border bg-pragma-light-blue/50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Integraciones"
            title="Conectado a tu stack operativo."
            description="Integraciones disponibles en PRAGMA para operar renta corta sin duplicar herramientas."
            align="center"
          />
        </FadeIn>

        <Stagger className="mt-10 flex flex-wrap justify-center gap-4">
          {integrations.map((item) => (
            <StaggerItem key={item.name}>
              <div className="flex min-w-[200px] flex-col items-center rounded-2xl border border-pragma-border bg-white px-6 py-5 text-center shadow-pragma-soft">
                <item.icon className="h-6 w-6 text-pragma-electric" strokeWidth={1.75} />
                <p className="mt-3 font-heading text-sm font-semibold text-pragma-black">
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-pragma-mid-gray">{item.detail}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
