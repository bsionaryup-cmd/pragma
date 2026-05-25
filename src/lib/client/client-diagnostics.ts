"use client";

const STORAGE_KEY = "pragma-client-errors";
const MAX_ERRORS = 12;

export type ClientDiagnosticEntry = {
  message: string;
  stack?: string;
  at: string;
  route?: string;
};

function readStore(): ClientDiagnosticEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClientDiagnosticEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(entries: ClientDiagnosticEntry[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ERRORS)));
}

export function recordClientError(error: unknown, route?: string) {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const stack =
    error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined;
  const entries = readStore();
  entries.push({
    message: message.slice(0, 500),
    stack: stack?.slice(0, 2000),
    at: new Date().toISOString(),
    route: route ?? window.location.pathname,
  });
  writeStore(entries);
}

export function getClientDiagnostics(): ClientDiagnosticEntry[] {
  return readStore();
}

export function getBrowserDiagnostics() {
  if (typeof window === "undefined") return null;
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function installClientErrorCapture() {
  if (typeof window === "undefined") return;
  if ((window as Window & { __pragmaErrorsInstalled?: boolean }).__pragmaErrorsInstalled) {
    return;
  }
  (window as Window & { __pragmaErrorsInstalled?: boolean }).__pragmaErrorsInstalled = true;

  window.addEventListener("error", (event) => {
    recordClientError(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordClientError(event.reason);
  });
}
