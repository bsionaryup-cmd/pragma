"use server";

import { revalidatePath } from "next/cache";
import { createLead, type CreateLeadInput } from "@/services/leads/lead.service";

export async function submitLeadAction(input: CreateLeadInput) {
  const result = await createLead(input);
  revalidatePath("/");
  revalidatePath("/contact");
  return result;
}
