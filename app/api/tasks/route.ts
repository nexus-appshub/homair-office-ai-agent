import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedStatuses = new Set([
  "queued", "planning", "awaiting_approval", "running",
  "succeeded", "failed", "cancelled", "expired",
]);

export async function GET(request: Request) {
  const authorization = await requirePermission("tasks.read");
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
  const status = url.searchParams.get("status");
  const limitValue = Number(url.searchParams.get("limit") || 25);
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(100, Math.floor(limitValue))) : 25;

  if (status && !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Unsupported task status filter." }, {
      status: 400, headers: { "Cache-Control": "private, no-store" },
    });
  }

  let query = supabase
    .from("office_tasks")
    .select("id,title,department,status,priority,requires_approval,created_at,updated_at,assigned_to,created_by")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Task data is unavailable. Verify the latest database migration and RLS policies." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json({
    tasks: data ?? [],
    generatedAt: new Date().toISOString(),
    source: "supabase",
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
