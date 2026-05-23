"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type ClerkSignOutButtonProps = {
  redirectUrl?: string;
  children: React.ReactNode;
} & Pick<ComponentProps<typeof Button>, "variant" | "className">;

export function ClerkSignOutButton({
  redirectUrl = "/sign-in?signed_out=1",
  children,
  variant = "outline",
  className,
}: ClerkSignOutButtonProps) {
  return (
    <SignOutButton redirectUrl={redirectUrl}>
      <Button type="button" variant={variant} className={className}>
        {children}
      </Button>
    </SignOutButton>
  );
}
