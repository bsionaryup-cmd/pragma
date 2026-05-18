"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUserActiveAction } from "@/features/users/actions/user.actions";

export function UserActiveToggle({
  userId,
  isActive,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await setUserActiveAction(userId, !isActive);
            toast.success(isActive ? "Usuario desactivado" : "Usuario activado");
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "No se pudo actualizar",
            );
          }
        })
      }
    >
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
