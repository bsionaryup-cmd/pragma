"use client";

import { motion } from "framer-motion";
import { CalendarDays, Receipt, TrendingUp, Wallet } from "lucide-react";
import {
  LANDING_MARKETING_SCREENSHOTS,
  LandingProductScreenshot,
} from "@/components/landing/landing-product-screenshot";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import type { LandingSession } from "@/lib/landing-session";

const ease = [0.21, 0.47, 0.32, 0.98] as const;

const highlights = [
  { icon: CalendarDays, label: "Calendario operativo" },
  { icon: TrendingUp, label: "Gestión de reservas" },
  { icon: Wallet, label: "Panel financiero" },
  { icon: Receipt, label: "Ocupación y KPIs" },
] as const;

type LandingHeroProps = {
  session: LandingSession;
};

export function LandingHero({ session: _session }: LandingHeroProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-10 pb-14 sm:px-6 md:pt-16 md:pb-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="max-w-xl lg:max-w-none">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
            className="font-accent mb-5 inline-flex items-center gap-2 rounded-full border border-pragma-border bg-pragma-light-blue px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-pragma-electric"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pragma-cyan" aria-hidden />
            PMS para alojamientos
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06, ease }}
            className="font-heading text-[1.85rem] font-bold leading-[1.15] tracking-tight text-pragma-black sm:text-3xl lg:text-[2.35rem] lg:leading-[1.1]"
          >
            Todo tu negocio de alojamientos en un solo lugar.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease }}
            className="mt-4 text-base leading-relaxed text-pragma-mid-gray sm:text-lg"
          >
            Calendario, reservas, finanzas y accesos conectados. Menos herramientas
            sueltas, más control operativo desde un panel central.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease }}
            className="mt-6 grid grid-cols-2 gap-2 sm:gap-3"
          >
            {highlights.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 rounded-xl border border-pragma-border bg-white px-3 py-2 text-xs font-medium text-pragma-black sm:text-sm"
              >
                <item.icon className="h-4 w-4 shrink-0 text-pragma-electric" strokeWidth={1.75} />
                {item.label}
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <CommercialContactButton label="Solicitar demo" size="lg" />
            <CommercialContactButton
              label="Hablar con un experto"
              size="lg"
              variant="outline"
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.24, ease }}
            className="mt-3 text-xs text-pragma-mid-gray"
          >
            {SUBSCRIPTION_TRIAL_LABEL} · Acceso desde el header cuando estés listo
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease }}
          className="relative lg:pl-2"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-pragma-gradient opacity-[0.1] blur-3xl md:-inset-8"
          />
          <LandingProductScreenshot
            {...LANDING_MARKETING_SCREENSHOTS.hero}
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}
