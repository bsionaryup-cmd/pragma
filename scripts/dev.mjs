/**
 * Arranca Next con variables de .env.local (override sobre env del sistema).
 * Regenera Prisma Client antes de iniciar para evitar imports/schema desincronizados.
 */
import { execSync, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

// El proxy /__clerk solo aplica en producción; en desarrollo provoca host_invalid de Clerk.
delete process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
delete process.env.CLERK_PROXY_URL;

const lockPath = join(process.cwd(), ".next", "dev", "lock");

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

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

function isPortBusy(port) {
  return new Promise((resolve) => {
    const server = createConnection({ port, host: "127.0.0.1" });
    server.once("connect", () => {
      server.destroy();
      resolve(true);
    });
    server.once("error", () => resolve(false));
    setTimeout(() => {
      server.destroy();
      resolve(false);
    }, 400);
  });
}

async function resolveDevPort() {
  if (process.env.PORT) return process.env.PORT;

  for (const port of [3000, 3001, 3002, 3003]) {
    if (!(await isPortBusy(port))) return String(port);
  }

  console.error(
    "\nNo hay puertos libres entre 3000 y 3003. Ejecuta: npm run dev:clean\n",
  );
  process.exit(1);
}

ensureSingleDevServer();

console.log("Regenerando Prisma Client…");
execSync("npx prisma generate", { stdio: "inherit", cwd: process.cwd() });

const port = await resolveDevPort();
if (port !== "3000") {
  console.warn(
    `\nPuerto 3000 ocupado por otro proceso. Servidor en http://localhost:${port}`,
  );
  console.warn(
    "Para liberar 3000: Administrador de tareas → Node.js, o PowerShell como admin → taskkill /F /PID <pid>\n",
  );
}

const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: port },
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code ?? 1));
