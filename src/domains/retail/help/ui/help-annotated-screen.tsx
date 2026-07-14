"use client";

/** Annotated schematic of a real INTIENDAS screen (callouts from audited UI). */
export function HelpAnnotatedScreen({
  title,
  callouts,
}: {
  title: string;
  callouts: Array<{ n: number; label: string; detail: string }>;
}) {
  if (!callouts.length) return null;

  return (
    <figure className="overflow-hidden rounded-md border border-[#d5dce6] bg-white">
      <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#718096]">
        Esquema anotado — {title}
      </div>
      <div className="relative grid gap-4 p-4 md:grid-cols-[1.2fr_1fr]">
        <div className="relative min-h-[180px] rounded-md border border-dashed border-[#c5ced8] bg-[#eef3f9] p-4">
          <div className="mb-3 h-8 rounded bg-white shadow-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-20 rounded bg-white/90 shadow-sm" />
            <div className="h-20 rounded bg-white/90 shadow-sm" />
          </div>
          <div className="mt-2 h-16 rounded bg-white/80 shadow-sm" />
          <div className="pointer-events-none absolute inset-0">
            {callouts.slice(0, 4).map((c, i) => {
              const positions = [
                "left-3 top-3",
                "right-3 top-10",
                "left-6 bottom-8",
                "right-8 bottom-4",
              ];
              return (
                <span
                  key={c.n}
                  className={`absolute flex size-7 items-center justify-center rounded-full bg-pragma-electric text-xs font-bold text-white shadow ${positions[i] ?? "left-1/2 top-1/2"}`}
                >
                  {c.n}
                </span>
              );
            })}
          </div>
        </div>
        <ol className="space-y-2 text-sm text-[#4a5568]">
          {callouts.map((c) => (
            <li key={c.n} className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pragma-electric text-xs font-bold text-white">
                {c.n}
              </span>
              <span>
                <strong className="text-[#2d3748]">{c.label}.</strong> {c.detail}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="border-t border-[#e2e8f0] px-4 py-2 text-[11px] text-[#94a3b8]">
        Basado en la interfaz real de INTIENDAS. Los números señalan zonas de la pantalla.
      </figcaption>
    </figure>
  );
}
