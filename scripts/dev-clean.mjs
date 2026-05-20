/**
 * Detiene servidores Next.js huérfanos del proyecto y elimina el lock de desarrollo.
 */
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DEV_PORTS, killListenersOnPorts, killPid } from "./dev-port-utils.mjs";

const lockPath = join(process.cwd(), ".next", "dev", "lock");

const killed = [];

if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    if (killPid(Number(lock.pid))) killed.push(lock.pid);
  } catch {
    // lock corrupto
  }
  try {
    unlinkSync(lockPath);
    console.log("Lock de desarrollo eliminado.");
  } catch {
    // en uso
  }
}

for (const pid of killListenersOnPorts(DEV_PORTS)) {
  killed.push(pid);
}

const unique = [...new Set(killed)];

if (unique.length === 0) {
  console.log("No había servidores Next.js que detener en los puertos 3000–3010.");
} else {
  console.log(`Procesos detenidos: ${unique.join(", ")}`);
  console.log("Ejecuta: npm run dev");
}
