"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRoleAction } from "@/features/users/actions/user.actions";
import { UserRole } from "@prisma/client";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  RECEPTIONIST: "Recepcionista",
};

export function UserRoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: UserRole;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      disabled={disabled || pending}
      value={currentRole}
      onValueChange={(value) =>
        startTransition(async () => {
          try {
            await updateUserRoleAction(userId, value as UserRole);
            toast.success("Rol actualizado");
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "No se pudo actualizar el rol",
            );
          }
        })
      }
    >
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.values(UserRole).map((role) => (
          <SelectItem key={role} value={role}>
            {roleLabels[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
