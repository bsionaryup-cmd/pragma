import { CheckCircle2, Heart, Home } from "lucide-react";
import { DEFAULT_HOUSE_RULES } from "./stay-portal-ui-helpers";

/** Guest-facing house rules — curated top 5 (not property free-text dump). */
export function HouseRulesCard() {
  return (
    <section
      aria-labelledby="stay-house-rules-title"
      className="flex h-full flex-col rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-pragma-soft sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600"
          aria-hidden
        >
          <Home className="h-5 w-5" />
        </span>
        <h2
          id="stay-house-rules-title"
          className="text-base font-semibold text-foreground"
        >
          Reglas de la casa
        </h2>
      </div>

      <ul className="mt-4 space-y-2.5">
        {DEFAULT_HOUSE_RULES.map((rule) => (
          <li key={rule} className="flex gap-2.5 text-sm text-foreground">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
              aria-hidden
            />
            <span>{rule}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2 rounded-xl bg-amber-100/70 px-3 py-2.5 text-sm text-foreground md:mt-auto">
        <Heart className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p>
          ¡Gracias por cuidar el alojamiento! Esperamos que disfrutes tu
          estadía.
        </p>
      </div>
    </section>
  );
}
