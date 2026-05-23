"use client";

import { FadeIn } from "@/components/landing/motion";

const highlights = [
  {
    title: "Multi-propiedad",
    description: "Gestiona varias unidades desde un solo panel.",
  },
  {
    title: "Reservas centralizadas",
    description: "Calendario, check-in y operación en un solo lugar.",
  },
  {
    title: "Hecho para Colombia",
    description: "Facturación, pagos y flujos locales integrados.",
  },
];

export function LandingSocialProof() {
  return (
    <section className="border-t border-pragma-border bg-pragma-soft-gray py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <FadeIn>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-pragma-mid-gray">
            Diseñado para operadores profesionales
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-pragma-border bg-white px-6 py-8 text-center shadow-sm"
              >
                <p className="font-heading text-lg font-bold">{item.title}</p>
                <p className="mt-2 text-sm text-pragma-mid-gray">{item.description}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
