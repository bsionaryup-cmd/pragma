"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accessStayPortalAction,
  type StayPortalAccessActionState,
} from "@/app/stay/actions";

const initialState: StayPortalAccessActionState = {};

export function StayPortalAccessForm() {
  const [state, formAction, pending] = useActionState(
    accessStayPortalAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reservationCode">Código de reserva</Label>
        <Input
          id="reservationCode"
          name="reservationCode"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ej. HMXXXXXX"
          required
          minLength={6}
          maxLength={20}
          className="h-11"
        />
      </div>
      {state.error ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-destructive">{state.error}</p>
          {state.reason === "registration_pending" && state.registrationUrl ? (
            <Button asChild className="h-11 w-full">
              <a href={state.registrationUrl}>Completar registro</a>
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Validando…" : "Ver mi estadía"}
      </Button>
    </form>
  );
}
