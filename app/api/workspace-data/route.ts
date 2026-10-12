import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, type OfficePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DatasetSchema = z.enum([
  "support", "customers", "packages", "orders", "payments", "campaigns",
  "content", "creative", "assets", "tasks", "approvals", "monitors",
  "incidents", "reports", "audit", "integrations",
]);

const Specs: Record<z.infer<typeof DatasetSchema>, {
  permission: OfficePermission;
  table: string;
  columns: string;
  orderBy: string;
}> = {
  support: { permission: "support.read", table: "support_tickets", columns: "id,customer_id,external_ticket_id,channel,subject,category,priority,status,assigned_to,created_at,updated_at", orderBy: "created_at" },
  customers: { permission: "customers.read", table: "customer_records", columns: "id,external_customer_id,display_name,email,status,source_system,created_at,updated_at", orderBy: "created_at" },
  packages: { permission: "packages.read", table: "packages", columns: "id,code,name,description,price_minor_units,currency,duration_days,is_active,created_at,updated_at", orderBy: "created_at" },
  orders: { permission: "orders.read", table: "orders", columns: "id,customer_id,external_order_id,amount_minor_units,currency,status,source_system,created_at,updated_at", orderBy: "created_at" },
  payments: { permission: "payments.read", table: "payment_records", columns: "id,order_id,provider,payment_reference,amount_minor_units,currency,status,verified_at,source_system,created_at,updated_at", orderBy: "created_at" },
  campaigns: { permission: "marketing.read", table: "campaigns", columns: "id,title,objective,language,status,planned_start_at,created_by,approved_by,created_at,updated_at", orderBy: "created_at" },
  content: { permission: "marketing.read", table: "content_drafts", columns: "id,campaign_id,platform,content_type,caption,hashtags,status,scheduled_at,external_post_id,created_by,approved_by,created_at,updated_at", orderBy: "created_at" },
  creative: { permission: "creative.read", table: "creative_jobs", columns: "id,campaign_id,provider,job_type,aspect_ratio,status,provider_job_id,error_code,created_by,created_at,updated_at", orderBy: "created_at" },
  assets: { permission: "creative.read", table: "media_assets", columns: "id,creative_job_id,mime_type,byte_size,checksum_sha256,visibility,created_by,created_at", orderBy: "created_at" },
  tasks: { permission: "tasks.read", table: "office_tasks", columns: "id,title,department,status,priority,requires_approval,created_by,assigned_to,result_summary,created_at,updated_at", orderBy: "created_at" },
  approvals: { permission: "approvals.read", table: "approval_requests", columns: "id,task_id,requester_user_id,approver_user_id,action_type,resource_type,resource_id,explanation,risk_level,status,expires_at,decision_at,created_at", orderBy: "created_at" },
  monitors: { permission: "monitoring.read", table: "service_monitors", columns: "id,name,hostname,path,is_enabled,interval_seconds,last_status,last_checked_at,created_at,updated_at", orderBy: "created_at" },
  incidents: { permission: "monitoring.read", table: "incidents", columns: "id,monitor_id,severity,status,title,safe_summary,opened_at,resolved_at,created_at", orderBy: "created_at" },
  reports: { permission: "reports.read", table: "report_runs", columns: "id,report_type,status,period_start,period_end,generated_at,safe_summary,error_code,created_at", orderBy: "created_at" },
  audit: { permission: "audit.read", table: "audit_logs", columns: "id,actor_user_id,actor_type,event_type,resource_type,resource_id,outcome,correlation_id,safe_metadata,created_at", orderBy: "created_at" },
  integrations: { permission: "integrations.read", table: "integration_connections", columns: "id,provider,display_name,connection_status,last_checked_at,last_error_safe,created_at,updated_at", orderBy: "created_at" },
};

function safeError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const parsed = DatasetSchema.safeParse(request.nextUrl.searchParams.get("dataset"));
  if (!parsed.success) return safeError("Choose a supported workspace dataset.", 400);

  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return safeError("Invalid pagination. Page must be positive and limit must be between 1 and 50.", 400);
  }

  const dataset = parsed.data;
  const spec = Specs[dataset];
  const authorization = await requirePermission(spec.permission);
  if (!authorization.ok) return safeError(authorization.error, authorization.status);

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return safeError("Database/authentication is not configured.", 503);
  }

  // Table names, projections, and ordering are selected only from this fixed allowlist.
  const { data, error, count } = await supabase
    .from(spec.table as never)
    .select(spec.columns as never, { count: "exact" })
    .order(spec.orderBy as never, { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    console.error("[workspace-data] Read failed", { dataset, code: error.code ?? "unknown" });
    return safeError("The data source is unavailable. Verify migrations, permissions, and row-level security.", 503);
  }

  const records = (data ?? []) as unknown as Record<string, unknown>[];
  const redacted = dataset === "payments"
    ? records.map((record) => {
        const reference = typeof record.payment_reference === "string" ? record.payment_reference : "";
        return { ...record, payment_reference: reference.length > 4 ? "••••" + reference.slice(-4) : (reference ? "••••" : null) };
      })
    : records;

  return NextResponse.json({
    dataset,
    page,
    limit,
    total: count ?? 0,
    records: redacted,
    dataSource: "supabase",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
