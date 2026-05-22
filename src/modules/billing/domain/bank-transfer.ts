export const BANK_TRANSFER_DETAILS = {
  bankName: "Bancolombia",
  accountType: "Cuenta de ahorros",
  accountNumber: process.env.PRAGMA_BANK_ACCOUNT ?? "000-000000-00",
  accountHolder: process.env.PRAGMA_BANK_HOLDER ?? "PRAGMA SAS",
  nit: process.env.PRAGMA_BANK_NIT ?? "900.000.000-0",
  email: process.env.PRAGMA_BILLING_EMAIL ?? "facturacion@pragma.co",
} as const;
