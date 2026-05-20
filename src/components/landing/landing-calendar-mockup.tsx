"use client";

import { cn } from "@/lib/utils";

const MOCK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MOCK_BARS = [
  { left: "8%", width: "22%", color: "bg-[#0E9F8D]" },
  { left: "35%", width: "18%", color: "bg-[#14B8A6]" },
  { left: "58%", width: "28%", color: "bg-[#0E9F8D]/80" },
];

export function LandingCalendarMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#E9ECEF] bg-[#111315] shadow-pragma-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[#2A2F36] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#F5A524]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#0E9F8D]/80" />
        <span className="ml-2 text-xs text-[#9CA3AF]">Calendario multi-propiedad</span>
      </div>

      <div className="grid grid-cols-7 gap-px border-b border-[#2A2F36] bg-[#15181c] px-2 py-2">
        {MOCK_DAYS.map((d) => (
          <span
            key={d}
            className="text-center text-[10px] font-medium text-[#9CA3AF]"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {[1, 2, 3].map((row) => (
          <div
            key={row}
            className="relative h-12 rounded-lg bg-[#15181c] ring-1 ring-[#2A2F36]"
          >
            {MOCK_BARS.map((bar, i) => (
              <div
                key={i}
                className={cn(
                  "absolute top-2 h-8 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
                  bar.color,
                )}
                style={{ left: bar.left, width: bar.width }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#111315] to-transparent" />
    </div>
  );
}
