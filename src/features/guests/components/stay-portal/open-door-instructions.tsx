import { DoorOpen, Info } from "lucide-react";
import { DEFAULT_DOOR_STEPS } from "./stay-portal-ui-helpers";

/** Tres pasos curados — prioridad UX sobre texto libre de la propiedad. */
export function OpenDoorInstructions() {
  return (
    <section
      aria-labelledby="stay-open-door-title"
      className="flex h-full flex-col rounded-2xl border border-sky-200/70 bg-sky-50/60 p-4 shadow-pragma-soft sm:p-5 dark:border-sky-900/40 dark:bg-sky-950/20"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <DoorOpen className="h-5 w-5" />
        </span>
        <h2
          id="stay-open-door-title"
          className="text-base font-semibold text-foreground"
        >
          Cómo abrir la puerta
        </h2>
      </div>

      <ol className="mt-4 space-y-3">
        {DEFAULT_DOOR_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-foreground">
                {step.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex gap-2 rounded-xl bg-sky-100/80 px-3 py-2.5 text-sm text-foreground md:mt-auto dark:bg-sky-900/30">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          Antes de salir, verifica que la puerta y las ventanas queden bien
          cerradas.
        </p>
      </div>
    </section>
  );
}
