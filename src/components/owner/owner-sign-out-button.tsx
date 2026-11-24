"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { performFullSignOut } from "@/lib/auth/full-sign-out";

export function OwnerSignOutButton() {
  const { signOut } = useClerk();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void performFullSignOut(signOut)}
    >
      Cerrar sesión
    </Button>
  );
}
