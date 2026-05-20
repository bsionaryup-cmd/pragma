/**
 * Utilidades compartidas para liberar puertos de desarrollo (3000–3010).
 */
import { execSync } from "node:child_process";
import { createConnection } from "node:net";

export const DEV_PORTS = [
  3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010,
];

export function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid) {
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

export function getListeningPids(port) {
  const pids = new Set();
  if (process.platform !== "win32") return pids;

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

  return pids;
}

export function killListenersOnPorts(ports = DEV_PORTS) {
  const killed = [];
  for (const port of ports) {
    for (const pid of getListeningPids(port)) {
      if (killPid(pid)) killed.push(pid);
    }
  }
  return [...new Set(killed)];
}

export function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 400);
  });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
