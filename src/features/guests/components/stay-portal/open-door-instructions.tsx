import { DoorOpen, Hand, Info, Keyboard, ShieldAlert } from "lucide-react";
import {
  DEFAULT_DOOR_STEPS,
  DOOR_FOOTER,
} from "./stay-portal-ui-helpers";

const STEP_ICONS = [Hand, Keyboard, ShieldAlert] as const;

/** Copy and structure taken from the approved Stay mockup. */
export function OpenDoorInstructions() {
  return (
    <section
      aria-labelledby="stay-open-door-title"
      className="flex h-full flex-col rounded-2xl border border-sky-200 bg-[#eff6ff] p-4 shadow-pragma-soft sm:p-5"
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

      <ol className="mt-4 space-y-3.5">
        {DEFAULT_DOOR_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[index] ?? Hand;
          return (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                </div>
                <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex gap-2 rounded-xl bg-sky-100 px-3 py-2.5 text-sm text-foreground md:mt-auto">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>{DOOR_FOOTER}</p>
      </div>
    </section>
  );
}
