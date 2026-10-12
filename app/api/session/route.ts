import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/**
 * Returns only the signed-in user's safe workspace identity. This endpoint is
 * intentionally session-scoped and never returns provider credentials.
 */
export async function GET() {
  const authorization = await requirePermission("dashboard.read");
  if (!authorization.ok) {
    return jsonError(authorization.error, authorization.status);
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return jsonError("Authentication is not configured.", 503);
  }

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("email,display_name,role,is_active")
    .eq("user_id", authorization.userId)
    .maybeSingle();

  if (error) {
    return jsonError("Workspace identity is temporarily unavailable.", 503);
  }

  if (!profile || profile.is_active !== true) {
    return jsonError("Workspace access is not enabled for this account.", 403);
  }

  return NextResponse.json(
    {
      user: {
        id: authorization.userId,
        email: profile.email,
        displayName: profile.display_name,
        role: profile.role,
      },
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
