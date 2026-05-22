"use client";

import { FadeIn } from "@/components/landing/motion";

const stats = [
  { label: "Anfitriones en Colombia", value: "500+" },
  { label: "Reservas gestionadas", value: "12k+" },
  { label: "Propiedades conectadas", value: "800+" },
];

export function LandingSocialProof() {
  return (
    <section className="border-t border-pragma-border bg-pragma-soft-gray py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-pragma-mid-gray">
            Operadores que confían en PRAGMA
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-pragma-border bg-white px-6 py-8 text-center shadow-sm"
              >
                <p className="font-heading text-3xl font-bold tabular-nums">{item.value}</p>
                <p className="mt-2 text-sm text-pragma-mid-gray">{item.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
