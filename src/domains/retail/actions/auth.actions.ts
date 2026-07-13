"use server";

import { issueRetailSignInTicket } from "../services/retail-auth.service";

export async function createRetailSignInTicketAction(input: {
  email: string;
  password: string;
}) {
  try {
    const result = await issueRetailSignInTicket(input);
    return { success: true as const, ticket: result.ticket };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
    };
  }
}
