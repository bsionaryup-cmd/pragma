import {
  resolveOwnerProspectingApiAuth,
  tenantProspectingApiRetiredResponse,
} from "@/lib/api/require-owner-prospecting-api";

export const maxDuration = 30;

export async function POST(_request: Request) {
  const auth = await resolveOwnerProspectingApiAuth();
  if (!auth.ok) {
    return auth.response;
  }

  return tenantProspectingApiRetiredResponse();
}
