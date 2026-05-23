"use client";

import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FinanceDateFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
};

export function FinanceDateField({
  id,
  name,
  label,
  defaultValue,
  required,
  disabled,
}: FinanceDateFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          "relative cursor-pointer rounded-xl border border-input bg-card transition-colors",
          "hover:border-pragma-electric/40 focus-within:border-pragma-electric focus-within:ring-2 focus-within:ring-pragma-electric/20",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={(event) => {
          const input = event.currentTarget.querySelector("input");
          if (!input || disabled) return;
          if (typeof input.showPicker === "function") {
            input.showPicker();
          } else {
            input.focus();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const input = event.currentTarget.querySelector("input");
            input?.showPicker?.();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
      >
        <Input
          id={id}
          name={name}
          type="date"
          required={required}
          defaultValue={defaultValue}
          disabled={disabled}
          className="h-10 cursor-pointer border-0 bg-transparent pr-10 shadow-none focus-visible:ring-0"
        />
        <CalendarDays
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    </div>
  );
}
