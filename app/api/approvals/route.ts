import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedStatuses = new Set([
  "pending", "approved", "rejected", "expired", "executing", "completed", "failed", "cancelled",
]);

export async function GET(request: Request) {
  const authorization = await requirePermission("approvals.read");
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Database/authentication is not configured." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const limitValue = Number(url.searchParams.get("limit") || 25);
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(100, Math.floor(limitValue))) : 25;

  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Unsupported approval status filter." }, {
      status: 400, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data, error } = await supabase
    .from("approval_requests")
    .select("id,task_id,requester_user_id,approver_user_id,action_type,resource_type,resource_id,explanation,payload_hash,risk_level,status,expires_at,decision_at,decision_note,created_at,task:office_tasks(title,department,priority)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Approval data is unavailable. Apply the latest database migration and verify RLS." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Never return action_payload. It is an internal review artifact, not an API response.
  return NextResponse.json({
    approvals: data ?? [],
    generatedAt: new Date().toISOString(),
    source: "supabase",
    executionEnabled: false,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
