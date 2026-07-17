"use client";

import { useActionState } from "react";
import {
  accessAirbnbGuestRegistrationAction,
  initialAirbnbUniversalAccessState,
} from "@/app/guest-registration/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AirbnbUniversalAccessForm() {
  const [state, formAction, isPending] = useActionState(
    accessAirbnbGuestRegistrationAction,
    initialAirbnbUniversalAccessState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="reservationCode">Código de reserva de Airbnb</Label>
        <Input
          id="reservationCode"
          name="reservationCode"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
          placeholder="Ej. HMXXXXXXXX"
          required
          aria-describedby="reservation-code-help"
        />
        <p
          id="reservation-code-help"
          className="text-xs leading-5 text-muted-foreground"
        >
          Lo encuentras en la confirmación y en los mensajes de tu reserva.
        </p>
      </div>

      {state.error ? (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Validando reserva…" : "Continuar al registro"}
      </Button>
    </form>
  );
}
