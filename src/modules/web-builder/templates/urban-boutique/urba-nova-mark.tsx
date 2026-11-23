import { cn } from "@/lib/utils";

type UrbaNovaMarkProps = {
  className?: string;
  markClassName?: string;
  /** horizontal = header; stacked = footer/principal; mark = solo isotipo */
  variant?: "horizontal" | "stacked" | "mark";
  inverted?: boolean;
};

/**
 * Isotipo oficial (manual): techo con chimenea + monograma UN.
 * Dibujo vectorial legible a tamaño de header (~36–44px).
 */
function UrbaNovaIsotipo({
  className,
  inverted,
}: {
  className?: string;
  inverted?: boolean;
}) {
  const ink = inverted ? "#F6F4F1" : "#1F1F1F";
  return (
    <svg
      viewBox="0 0 80 70"
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
    >
      {/* Chimenea */}
      <rect x="52" y="6" width="10" height="14" rx="1" stroke={ink} strokeWidth="2.2" />
      {/* Techo */}
      <path
        d="M8 32 L40 6 L72 32"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Monograma tipográfico UN (serif contraste) */}
      <text
        x="40"
        y="58"
        textAnchor="middle"
        fill={ink}
        fontFamily="Georgia, 'Times New Roman', Times, serif"
        fontSize="28"
        fontWeight="700"
        letterSpacing="-1.5"
      >
        UN
      </text>
    </svg>
  );
}

/**
 * Logotipo URBA NOVA LOFT 33 según manual de marca.
 */
export function UrbaNovaMark({
  className,
  markClassName,
  variant = "horizontal",
  inverted = false,
}: UrbaNovaMarkProps) {
  const ink = inverted ? "text-[#F6F4F1]" : "text-[#1F1F1F]";
  const muted = inverted ? "text-white/75" : "text-[#7C7A78]";

  if (variant === "mark") {
    return (
      <UrbaNovaIsotipo
        inverted={inverted}
        className={cn("h-10 w-11", markClassName)}
      />
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-1.5", className, ink)}>
        <UrbaNovaIsotipo
          inverted={inverted}
          className={cn("h-14 w-16", markClassName)}
        />
        <span className="font-[family-name:var(--wb-font-display)] text-sm font-semibold uppercase tracking-[0.28em]">
          URBA NOVA
        </span>
        <span
          className={cn(
            "font-[family-name:var(--wb-font-display)] text-xs font-medium italic tracking-[0.18em]",
            muted,
          )}
        >
          LOFT 33
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className, ink)}>
      <UrbaNovaIsotipo
        inverted={inverted}
        className={cn("h-9 w-10 md:h-10 md:w-12", markClassName)}
      />
      <span
        className="hidden h-9 w-px shrink-0 bg-current/20 sm:block"
        aria-hidden
      />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-[family-name:var(--wb-font-display)] text-[12px] font-semibold uppercase tracking-[0.22em] md:text-[13px]">
          URBA NOVA
        </div>
        <div
          className={cn(
            "truncate font-[family-name:var(--wb-font-display)] text-[10px] font-medium italic tracking-[0.16em] md:text-[11px]",
            muted,
          )}
        >
          LOFT 33
        </div>
      </div>
    </div>
  );
}
