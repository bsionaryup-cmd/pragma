/**
 * Arranca Next con variables de .env.local (override sobre env del sistema).
 * Regenera Prisma Client antes de iniciar para evitar imports/schema desincronizados.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import {
  DEV_PORTS,
  getListeningPids,
  isPortBusy,
  isProcessRunning,
  killListenersOnPorts,
  sleep,
} from "./dev-port-utils.mjs";

config();
config({ path: ".env.local", override: true });

// El proxy /__clerk solo aplica en producción; en desarrollo provoca host_invalid de Clerk.
delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
delete process.env.CLERK_PROXY_URL;

const lockPath = join(process.cwd(), ".next", "dev", "lock");

function ensureSingleDevServer() {
  if (!existsSync(lockPath)) return;

  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const pid = Number(lock.pid);
    const port = lock.port ?? 3000;

    if (pid && isProcessRunning(pid)) {
      console.error(
        `\nYa hay un servidor de desarrollo activo en http://localhost:${port} (PID ${pid}).`,
      );
      console.error("Opciones:");
      console.error(`  1. Usa esa URL en el navegador`);
      console.error(`  2. Detén el proceso: taskkill /PID ${pid} /F`);
      console.error(`  3. Limpia todo:      npm run dev:clean\n`);
      process.exit(1);
    }

    unlinkSync(lockPath);
    console.log("Se eliminó un lock de desarrollo obsoleto.");
  } catch {
    try {
      unlinkSync(lockPath);
      console.log("Se eliminó un lock de desarrollo inválido.");
    } catch {
      // otro proceso escribiendo el lock
    }
  }
}

async function freeStalePort3000() {
  if (!(await isPortBusy(3000))) return;

  const before = [...getListeningPids(3000)];
  const killed = killListenersOnPorts([3000]);
  await sleep(600);

  if (killed.length > 0 && !(await isPortBusy(3000))) return;

  const stuck = [...getListeningPids(3000)];
  if (stuck.length === 0) return;

  console.warn(
    "\n⚠ Puerto 3000 bloqueado por un Node.js colgado que no se pudo cerrar automáticamente.",
  );
  console.warn(`   PID: ${stuck.join(", ")}${before.length ? ` (antes: ${before.join(", ")})` : ""}`);
  console.warn("   En Windows: abre PowerShell **como administrador** y ejecuta:");
  console.warn(`   taskkill /F /PID ${stuck[0]}`);
  console.warn("   O cierra el proceso en el Administrador de tareas → Node.js\n");
}

async function resolveDevPort() {
  if (process.env.PORT) return process.env.PORT;

  await freeStalePort3000();

  for (const port of DEV_PORTS) {
    if (!(await isPortBusy(port))) return String(port);
  }

  console.error(
    "\nNo hay puertos libres entre 3000 y 3010. Ejecuta: npm run dev:clean\n",
  );
  process.exit(1);
}

ensureSingleDevServer();

function shouldRegeneratePrismaClient() {
  const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
  const clientPath = join(
    process.cwd(),
    "node_modules",
    ".prisma",
    "client",
    "index.js",
  );
  if (!existsSync(clientPath)) return true;
  try {
    return statSync(schemaPath).mtimeMs > statSync(clientPath).mtimeMs;
  } catch {
    return true;
  }
}

if (shouldRegeneratePrismaClient()) {
  console.log("Regenerando Prisma Client…");
  execSync("npx prisma generate", { stdio: "inherit", cwd: process.cwd() });
} else {
  console.log("Prisma Client al día — omitiendo generate.");
}

const port = await resolveDevPort();
if (port !== "3000") {
  console.warn(
    `\nPuerto 3000 sigue ocupado. Servidor en http://localhost:${port}`,
  );
  console.warn(
    "Usa exactamente esa URL en el navegador (no abras localhost:3000 si no coincide).\n",
  );
}

const devOrigin = `http://localhost:${port}`;

// Turbopack (default in Next 16) can hang on Windows in this project — webpack is stable.
const child = spawn("npx", ["next", "dev", "--webpack", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT: port,
    NEXT_PUBLIC_DEV_ORIGIN: devOrigin,
  },
  cwd: process.cwd(),
});

console.log(`\n→ Abre en el navegador: ${devOrigin}\n`);

child.on("exit", (code) => process.exit(code ?? 1));
