import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public probe: can the server see a Clerk session from cookies?
 * Must be a non-document fetch so Clerk does NOT handshake/wipe.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    return NextResponse.json(
      { ready: Boolean(userId), userId: userId ?? null },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { ready: false, userId: null },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
