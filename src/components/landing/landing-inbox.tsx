"use client";

import { FadeIn } from "@/components/landing/motion";
import { SectionHeading } from "@/components/landing/section-heading";

const messages = [
  {
    guest: "Carlos",
    preview: "¿En qué piso está el apartamento?",
    time: "21:00",
    status: "Abierta",
  },
  {
    guest: "Maryori R.",
    preview: "Hola, confirmo llegada mañana",
    time: "20:26",
    status: "Reservada",
  },
  {
    guest: "Alton",
    preview: "Gracias por la información",
    time: "19:14",
    status: "Abierta",
  },
];

export function LandingInbox() {
  return (
    <section id="inbox" className="border-t border-white/5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <SectionHeading
            eyebrow="Bandeja unificada"
            title="Todos los mensajes, un solo lugar"
            description="Conversaciones de Airbnb y canales directos con contexto de reserva, fechas y estado — sin perder el hilo."
            align="center"
          />
        </FadeIn>

        <FadeIn delay={0.12} className="mt-16">
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-violet-500/30 via-transparent to-transparent opacity-50" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 shadow-2xl">
              <div className="grid md:grid-cols-[280px_1fr]">
                <div className="border-b border-white/5 p-4 md:border-r md:border-b-0">
                  <p className="text-sm font-medium text-zinc-50">Bandeja de entrada</p>
                  <p className="mt-0.5 text-xs text-zinc-500">199 sin leer</p>
                  <ul className="mt-4 space-y-1">
                    {messages.map((msg, i) => (
                      <li
                        key={msg.guest}
                        className={`rounded-lg px-3 py-2.5 ${
                          i === 0 ? "bg-white/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-200">
                            {msg.guest}
                          </span>
                          <span className="text-[10px] text-zinc-500">{msg.time}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {msg.preview}
                        </p>
                        <span
                          className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] ${
                            msg.status === "Abierta"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {msg.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex min-h-[280px] flex-col p-5">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf894] text-sm font-semibold text-zinc-900">
                      C
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-50">Carlos</p>
                      <p className="text-xs text-zinc-500">Último mensaje: hoy 21:00</p>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-end gap-3 pt-4">
                    <div className="max-w-[85%] rounded-xl border border-white/5 bg-zinc-950/80 px-3 py-2">
                      <p className="text-xs text-zinc-300">
                        Hola. ¿En qué piso está el apartamento? Gracias.
                      </p>
                    </div>
                    <div className="ml-auto max-w-[85%] rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-xs text-zinc-200">
                        Está en el primer piso. ¡Bienvenido!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

