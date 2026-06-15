/**
 * Prueba histórica: asuntos "Reserva confirmada" no deben clasificar CANCELED.
 * npx tsx scripts/prove-router-confirmed-not-canceled.ts
 */
import { AirbnbEmailEventKind } from "@prisma/client";
import { classifyAirbnbEmail } from "@/modules/airbnb-email/router/airbnb-email-router";

const HISTORICAL_SUBJECTS = [
  "Fwd: Reserva confirmada: Miguel Castro llega el 30 ago.",
  "Fwd: Reserva confirmada: Karla Durán llega el 19 jun.",
  "Fwd: Reserva confirmada: Roberto Gonzalez Morales llega el 22 jun.",
  "Reserva confirmada: Milena Mercedes Barrero Cortes llega el 15 jun.",
  "Reserva confirmada — HM8K2P9Q4X",
];

const FOOTER_LEGAL_BODY = `
Reserva confirmada
Check-in: 2026-08-30
Check-out: 2026-09-02
Huésped: Miguel Castro
Código de confirmación: HMQDRNFBZW
If the reservation is cancelled please contact support
cancelled policy terms in footer
`;

let pass = 0;
let fail = 0;

console.log("=== Router proof: Reserva confirmada → CONFIRMED (not CANCELED) ===\n");

for (const subject of HISTORICAL_SUBJECTS) {
  const result = classifyAirbnbEmail({
    from: "urbanovaloft@gmail.com",
    subject,
    body: FOOTER_LEGAL_BODY,
  });
  const ok = result.eventKind === AirbnbEmailEventKind.CONFIRMED;
  if (ok) pass += 1;
  else fail += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${result.eventKind.padEnd(10)} | ${subject}`,
  );
}

console.log(`\n${pass}/${HISTORICAL_SUBJECTS.length} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
