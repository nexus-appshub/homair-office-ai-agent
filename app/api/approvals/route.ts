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
    .select("id,task_id,requester_user_id,approver_user_id,action_type,resource_type,resource_id,explanation,payload_hash,risk_level,status,expires_at,decision_at,decision_note,created_at,action_payload,task:office_tasks(title,department,priority)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Approval data is unavailable. Apply the latest database migration and verify RLS." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Return only the plan fields required for meaningful human review. The raw
  // action_payload and any unknown fields never leave this server boundary.
  const approvals = (data ?? []).map((row) => {
    const payload = row.action_payload && typeof row.action_payload === "object"
      ? row.action_payload as Record<string, unknown>
      : {};
    const candidate = payload.plan && typeof payload.plan === "object"
      ? payload.plan as Record<string, unknown>
      : {};
    const review = {
      title: typeof candidate.title === "string" ? candidate.title.slice(0, 160) : "Proposed task plan",
      summary: typeof candidate.summary === "string" ? candidate.summary.slice(0, 1600) : "",
      steps: Array.isArray(candidate.steps)
        ? candidate.steps.filter((step): step is string => typeof step === "string").slice(0, 8).map((step) => step.slice(0, 400))
        : [],
      approvalReason: typeof candidate.approvalReason === "string" ? candidate.approvalReason.slice(0, 500) : "",
      missingInputs: Array.isArray(candidate.missingInputs)
        ? candidate.missingInputs.filter((item): item is string => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 180))
        : [],
    };
    const { action_payload: _internalPayload, ...safeRow } = row;
    return { ...safeRow, review };
  });

  return NextResponse.json({
    approvals,
    generatedAt: new Date().toISOString(),
    source: "supabase",
    executionEnabled: false,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
