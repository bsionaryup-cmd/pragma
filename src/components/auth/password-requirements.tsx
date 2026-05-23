"use client";

import { Check } from "lucide-react";
import { getPasswordRuleStatuses } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";

type PasswordRequirementsProps = {
  password: string;
  visible: boolean;
};

export function PasswordRequirements({
  password,
  visible,
}: PasswordRequirementsProps) {
  if (!visible) return null;

  const rules = getPasswordRuleStatuses(password);

  return (
    <ul className="space-y-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={cn(
            "flex items-center gap-2 text-xs transition-colors",
            rule.met ? "text-success" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
              rule.met
                ? "border-success bg-success text-white"
                : "border-muted-foreground/40 bg-background",
            )}
            aria-hidden
          >
            {rule.met ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
          </span>
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
