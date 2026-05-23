"use client";

import { SignOutButton } from "@clerk/nextjs";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";

type OwnerWrongSessionProps = {
  email: string;
};

export function OwnerWrongSession({ email }: OwnerWrongSessionProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <BackLink href="/sign-in" label="Acceso clientes" />
      </div>
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
