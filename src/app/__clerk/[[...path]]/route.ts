import { createFrontendApiProxyHandlers } from "@clerk/nextjs/server";

/**
 * Proxy de la Frontend API de Clerk (mismo origen).
 * Evita "Failed to fetch" cuando el navegador bloquea *.clerk.accounts.dev.
 */
export const { GET, POST, PUT, DELETE, PATCH } =
  createFrontendApiProxyHandlers();
