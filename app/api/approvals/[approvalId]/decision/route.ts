import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).optional().default(""),
});

type RouteContext = { params: Promise<{ approvalId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authorization = await requirePermission("approvals.approve");
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, {
      status: authorization.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { approvalId } = await context.params;
  if (!z.string().uuid().safeParse(approvalId).success) {
    return NextResponse.json({ error: "A valid approval ID is required." }, {
      status: 400, headers: { "Cache-Control": "private, no-store" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, {
      status: 400, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose approve or reject and provide an optional note of at most 1,000 characters." }, {
      status: 400, headers: { "Cache-Control": "private, no-store" },
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

  const { data, error } = await supabase.rpc("decide_office_approval", {
    p_approval_id: approvalId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });

  if (error) {
    const denied = error.code === "42501";
    return NextResponse.json({ error: denied ? "This approval decision is not permitted." : "Could not record the approval decision. Verify the latest database migration and retry." }, {
      status: denied ? 403 : 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "The approval service returned an invalid response." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }

  const result = data as { ok?: boolean; code?: string; message?: string; execution_enabled?: boolean };
  if (result.ok !== true) {
    const status = result.code === "not_found" ? 404 : result.code === "expired" ? 410 : 409;
    return NextResponse.json({ error: result.message || "The approval could not be changed.", code: result.code }, {
      status, headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json({
    ...result,
    executionEnabled: false,
    message: "Decision recorded. No external action was executed.",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
