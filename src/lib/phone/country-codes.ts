export const DEFAULT_DIAL_CODE = "+57";

export type CountryPhoneCode = {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
};

/** Colombia primero; resto ordenado por nombre. */
export const COUNTRY_PHONE_CODES: CountryPhoneCode[] = [
  { iso: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { iso: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸" },
  { iso: "MX", name: "México", dialCode: "+52", flag: "🇲🇽" },
  { iso: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { iso: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷" },
  { iso: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { iso: "PE", name: "Perú", dialCode: "+51", flag: "🇵🇪" },
  { iso: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { iso: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { iso: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { iso: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { iso: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { iso: "PA", name: "Panamá", dialCode: "+507", flag: "🇵🇦" },
  { iso: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { iso: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { iso: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { iso: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { iso: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻" },
  { iso: "DO", name: "Rep. Dominicana", dialCode: "+1", flag: "🇩🇴" },
  { iso: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷" },
  { iso: "ES", name: "España", dialCode: "+34", flag: "🇪🇸" },
  { iso: "FR", name: "Francia", dialCode: "+33", flag: "🇫🇷" },
  { iso: "DE", name: "Alemania", dialCode: "+49", flag: "🇩🇪" },
  { iso: "IT", name: "Italia", dialCode: "+39", flag: "🇮🇹" },
  { iso: "GB", name: "Reino Unido", dialCode: "+44", flag: "🇬🇧" },
  { iso: "CA", name: "Canadá", dialCode: "+1", flag: "🇨🇦" },
  { iso: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { iso: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { iso: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { iso: "JP", name: "Japón", dialCode: "+81", flag: "🇯🇵" },
  { iso: "KR", name: "Corea del Sur", dialCode: "+82", flag: "🇰🇷" },
  { iso: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { iso: "RU", name: "Rusia", dialCode: "+7", flag: "🇷🇺" },
];

export function findCountryByDialCode(dialCode: string): CountryPhoneCode | undefined {
  return COUNTRY_PHONE_CODES.find((country) => country.dialCode === dialCode);
}

export function getDefaultCountry(): CountryPhoneCode {
  return COUNTRY_PHONE_CODES[0]!;
}
