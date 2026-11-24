"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { APP_SIGNED_OUT_LOGIN_PATH } from "@/lib/auth/auth-paths";
import { expireClientUatCookiesInBrowser } from "@/lib/auth/full-sign-out";

type ClerkSignOutButtonProps = {
  redirectUrl?: string;
  children: React.ReactNode;
} & Pick<ComponentProps<typeof Button>, "variant" | "className">;

export function ClerkSignOutButton({
  redirectUrl = APP_SIGNED_OUT_LOGIN_PATH,
  children,
  variant = "outline",
  className,
}: ClerkSignOutButtonProps) {
  return (
    <SignOutButton redirectUrl={redirectUrl}>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => expireClientUatCookiesInBrowser()}
      >
        {children}
      </Button>
    </SignOutButton>
  );
}
