"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function OwnerSignOutButton() {
  return (
    <SignOutButton redirectUrl="/owner-login">
      <Button type="button" variant="outline" size="sm">
        Cerrar sesión
      </Button>
    </SignOutButton>
  );
}
