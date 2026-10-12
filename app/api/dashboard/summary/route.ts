import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, type OfficePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MetricStatus = "ready" | "restricted" | "unavailable";
type Metric = { value: number | null; status: MetricStatus };
type CountResponse = { count: number | null; error: { message: string } | null };

const unavailableMetric: Metric = { value: null, status: "unavailable" };
const restrictedMetric: Metric = { value: null, status: "restricted" };

async function countMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  permission: OfficePermission,
  query: () => Promise<CountResponse>,
): Promise<Metric> {
  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_office_permission",
    { requested_permission: permission },
  );

  if (permissionError) return unavailableMetric;
  if (allowed !== true) return restrictedMetric;

  const result = await query();
  if (result.error) return unavailableMetric;

  return { value: result.count ?? 0, status: "ready" };
}

async function recentActivity(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: allowed, error: permissionError } = await supabase.rpc(
    "has_office_permission",
    { requested_permission: "audit.read" },
  );

  if (permissionError) return { status: "unavailable" as const, items: [] };
  if (allowed !== true) return { status: "restricted" as const, items: [] };

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,event_type,outcome,created_at,resource_type")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) return { status: "unavailable" as const, items: [] };

  return { status: "ready" as const, items: data ?? [] };
}

/**
 * The dashboard only receives aggregate counts and a small safe audit event
 * projection. Queries run as the signed-in user so Postgres RLS remains active.
 * A restricted/unavailable metric is null, never misreported as zero.
 */
export async function GET() {
  const authorization = await requirePermission("dashboard.read");
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Database/authentication is not configured." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const [supportInbox, customerRecords, pendingApprovals, scheduledContent, activity] =
    await Promise.all([
      countMetric(supabase, "support.read", () =>
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress", "waiting_customer", "escalated"]),
      ),
      countMetric(supabase, "customers.read", () =>
        supabase.from("customer_records").select("id", { count: "exact", head: true }),
      ),
      countMetric(supabase, "approvals.read", () =>
        supabase
          .from("approval_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      countMetric(supabase, "marketing.read", () =>
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled"),
      ),
      recentActivity(supabase),
    ]);

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      source: "postgresql",
      metrics: {
        supportInbox,
        customerRecords,
        pendingApprovals,
        scheduledContent,
      },
      recentActivity: activity,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
