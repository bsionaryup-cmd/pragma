"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoComplete?: "new-password" | "current-password" | "off";
  placeholder?: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  autoComplete = "new-password",
  placeholder = "••••••••",
  minLength,
  required,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="pr-10 pl-9"
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className={cn(
            "absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5",
            "text-muted-foreground hover:text-foreground",
          )}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
