import {
  resolveOwnerProspectingApiAuth,
  tenantProspectingApiRetiredResponse,
} from "@/lib/api/require-owner-prospecting-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, _context: RouteContext) {
  const auth = await resolveOwnerProspectingApiAuth();
  if (!auth.ok) {
    return auth.response;
  }

  return tenantProspectingApiRetiredResponse();
}

export async function PATCH(_request: Request, _context: RouteContext) {
  const auth = await resolveOwnerProspectingApiAuth();
  if (!auth.ok) {
    return auth.response;
  }

  return tenantProspectingApiRetiredResponse();
}
