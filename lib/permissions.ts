import { createClient } from "@/lib/supabase/server";

export type OfficePermission =
  | "dashboard.read"
  | "support.read"
  | "support.reply"
  | "customers.read"
  | "customers.update"
  | "packages.manage"
  | "payments.read"
  | "payments.verify"
  | "payments.refund"
  | "marketing.draft"
  | "marketing.approve"
  | "marketing.publish"
  | "creative.generate"
  | "monitoring.read"
  | "incidents.manage"
  | "settings.manage"
  | "users.manage"
  | "audit.read";

export type AuthorizationResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

// Call this inside every private Route Handler/server action before reading or
// mutating protected resources. Proxy gating is defence-in-depth, not a replacement.
export async function requirePermission(permission: OfficePermission): Promise<AuthorizationResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, status: 503, error: "Authentication is not configured." };
  }

  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string" || !userId) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) return { ok: false, status: 503, error: "Authorization service unavailable." };
  if (!profile?.is_active) return { ok: false, status: 403, error: "Access is not enabled for this account." };

  const { data: allowed, error: permissionError } = await supabase.rpc("has_office_permission", {
    requested_permission: permission,
  });

  if (permissionError) return { ok: false, status: 503, error: "Permission check unavailable." };
  if (allowed !== true) return { ok: false, status: 403, error: "You do not have permission for this action." };

  return { ok: true, userId };
}
