import {
  COUNTRY_PHONE_CODES,
  DEFAULT_DIAL_CODE,
  findCountryByDialCode,
} from "@/lib/phone/country-codes";

export type ParsedPhoneNumber = {
  dialCode: string;
  localNumber: string;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Separa código de país y número local desde un valor almacenado. */
export function parseStoredPhone(value: string | null | undefined): ParsedPhoneNumber {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { dialCode: DEFAULT_DIAL_CODE, localNumber: "" };
  }

  if (trimmed.startsWith("+")) {
    const sortedCodes = [...COUNTRY_PHONE_CODES].sort(
      (a, b) => b.dialCode.length - a.dialCode.length,
    );

    for (const country of sortedCodes) {
      if (trimmed.startsWith(country.dialCode)) {
        const rest = trimmed.slice(country.dialCode.length).trim();
        return {
          dialCode: country.dialCode,
          localNumber: digitsOnly(rest),
        };
      }
    }

    const generic = trimmed.match(/^(\+\d{1,4})\s*(.*)$/);
    if (generic) {
      return {
        dialCode: generic[1]!,
        localNumber: digitsOnly(generic[2] ?? ""),
      };
    }
  }

  const allDigits = digitsOnly(trimmed);
  if (allDigits.startsWith("57") && allDigits.length >= 10) {
    return {
      dialCode: DEFAULT_DIAL_CODE,
      localNumber: allDigits.slice(2),
    };
  }

  return {
    dialCode: DEFAULT_DIAL_CODE,
    localNumber: allDigits,
  };
}

/** Formato canónico para guardar: "+57 3001234567" */
export function formatStoredPhone(dialCode: string, localNumber: string): string {
  const localDigits = digitsOnly(localNumber);
  if (!localDigits) return "";
  const normalizedDialCode = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  return `${normalizedDialCode} ${localDigits}`;
}

export function isValidPhoneNumber(value: string | null | undefined): boolean {
  const formatted = value?.trim();
  if (!formatted) return false;

  const { dialCode, localNumber } = parseStoredPhone(formatted);
  const localDigits = digitsOnly(localNumber);
  if (localDigits.length < 6) return false;

  const countryDigits = digitsOnly(dialCode);
  const totalLength = countryDigits.length + localDigits.length;
  return totalLength >= 8 && totalLength <= 15;
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const { dialCode, localNumber } = parseStoredPhone(value);
  if (!localNumber) return dialCode;
  return formatStoredPhone(dialCode, localNumber);
}

export function getCountryLabelForPhone(value: string | null | undefined): string | null {
  const { dialCode } = parseStoredPhone(value);
  return findCountryByDialCode(dialCode)?.name ?? null;
}
