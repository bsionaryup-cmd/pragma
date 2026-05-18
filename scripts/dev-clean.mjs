/**
 * Detiene servidores Next.js huérfanos del proyecto y elimina el lock de desarrollo.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const lockPath = join(process.cwd(), ".next", "dev", "lock");
const ports = [3000, 3001, 3002, 3003];

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid) {
  if (!pid || !isProcessRunning(pid)) return false;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    return true;
  } catch {
    return false;
  }
}

function collectPidsFromPorts() {
  const pids = new Set();
  if (process.platform !== "win32") return pids;

  for (const port of ports) {
    try {
      const out = execSync(`netstat -ano | findstr ":${port}"`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of out.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const pid = Number(line.trim().split(/\s+/).pop());
        if (pid > 0) pids.add(pid);
      }
    } catch {
      // puerto libre
    }
  }
  return pids;
}

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

for (const pid of collectPidsFromPorts()) {
  if (killPid(pid)) killed.push(pid);
}

if (killed.length === 0) {
  console.log("No había servidores Next.js que detener en los puertos 3000–3003.");
} else {
  console.log(`Procesos detenidos: ${[...new Set(killed)].join(", ")}`);
  console.log("Ejecuta: npm run dev");
}
