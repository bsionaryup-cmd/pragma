/**
 * Diagnóstico rápido: puertos de desarrollo y respuesta HTTP.
 * Uso: npm run dev:doctor
 */
import { DEV_PORTS, getListeningPids, isPortBusy } from "./dev-port-utils.mjs";

async function probeHttp(port) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
      redirect: "manual",
    });
    return String(res.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    if (message.includes("abort")) return "sin respuesta (timeout)";
    return message;
  } finally {
    clearTimeout(timer);
  }
}

console.log("\nPRAGMA PMS — diagnóstico de desarrollo\n");

for (const port of DEV_PORTS) {
  const busy = await isPortBusy(port);
  const pids = [...getListeningPids(port)];
  const pidLabel = pids.length ? pids.join(", ") : "—";
  let http = "—";
  if (busy) http = await probeHttp(port);

  const status = !busy ? "libre" : http.startsWith("2") || http.startsWith("3") ? "OK" : "colgado";

  console.log(
    `  :${port}  ${status.padEnd(8)}  PID ${pidLabel.padEnd(8)}  HTTP ${http}`,
  );
}

console.log(
  "\nUsa la URL que marque OK (normalmente http://localhost:3000).\n" +
    "Si :3000 está colgado: PowerShell como admin → taskkill /F /PID <pid>\n" +
    "Luego: npm run dev:clean && npm run dev\n",
);
