"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteUserAction } from "@/features/users/actions/user.actions";

export function DeleteUserButton({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={disabled || pending}
      onClick={() => {
        const confirmed = window.confirm(
          `¿Eliminar a ${email}? Se quitará del equipo y se eliminará de Clerk.`,
        );
        if (!confirmed) return;

        startTransition(async () => {
          try {
            await deleteUserAction(userId);
            toast.success("Usuario eliminado");
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "No se pudo eliminar",
            );
          }
        });
      }}
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
