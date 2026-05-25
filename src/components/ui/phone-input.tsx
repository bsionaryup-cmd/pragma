"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { COUNTRY_PHONE_CODES, DEFAULT_DIAL_CODE } from "@/lib/phone/country-codes";
import {
  formatStoredPhone,
  parseStoredPhone,
} from "@/lib/phone/phone-number";
import { cn } from "@/lib/utils";

export type PhoneInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
};

export function PhoneInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "300 123 4567",
  className,
  "aria-invalid": ariaInvalid,
}: PhoneInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const parsed = useMemo(() => parseStoredPhone(value), [value]);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);

  useEffect(() => {
    queueMicrotask(() => {
      setDialCode(parsed.dialCode);
      setLocalNumber(parsed.localNumber);
    });
  }, [parsed.dialCode, parsed.localNumber]);

  function emitChange(nextDialCode: string, nextLocalNumber: string) {
    onChange(formatStoredPhone(nextDialCode, nextLocalNumber));
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative shrink-0">
        <select
          id={`${inputId}-dial-code`}
          value={dialCode}
          disabled={disabled}
          aria-label="Código de país"
          onChange={(event) => {
            const nextDialCode = event.target.value;
            setDialCode(nextDialCode);
            emitChange(nextDialCode, localNumber);
          }}
          className={cn(
            "h-9 min-w-[7.5rem] appearance-none rounded-md border border-input bg-card py-2 pr-8 pl-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            ariaInvalid && "border-destructive ring-destructive/20",
          )}
        >
          {COUNTRY_PHONE_CODES.map((country) => (
            <option key={`${country.iso}-${country.dialCode}`} value={country.dialCode}>
              {country.flag} {country.dialCode}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        >
          ▾
        </span>
      </div>

      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        value={localNumber}
        onChange={(event) => {
          const nextLocal = event.target.value.replace(/[^\d\s-]/g, "");
          setLocalNumber(nextLocal);
          emitChange(dialCode || DEFAULT_DIAL_CODE, nextLocal);
        }}
        className={cn(
          "h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          ariaInvalid && "border-destructive ring-destructive/20",
        )}
      />
    </div>
  );
}
