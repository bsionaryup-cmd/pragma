"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

type OwnerWrongSessionProps = {
  email: string;
};

export function OwnerWrongSession({ email }: OwnerWrongSessionProps) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">
        Has iniciado sesión como <span className="font-medium">{email}</span>, pero
        este acceso es exclusivo para el Super Admin Owner.
      </p>
      <SignOutButton redirectUrl="/owner-login">
        <Button type="button" variant="brand" className="w-full">
          Cerrar sesión e ingresar como owner
        </Button>
      </SignOutButton>
    </div>
  );
}
