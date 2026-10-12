"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, Bot, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, Command,
  FileText, Film, Headphones, LayoutDashboard, LockKeyhole, Menu,
  MessageSquare, Palette, Plug, Plus, Search, Send, Settings2, ShieldCheck,
  Sparkles, Users, Wallet, X, Megaphone, LogOut,
} from "lucide-react";

const navGroups = [
  { label: "WORKSPACE", items: [
    { label: "Overview", icon: LayoutDashboard },
    { label: "AI Command Center", icon: Command },
    { label: "Agents & Tasks", icon: Bot },
  ]},
  { label: "CUSTOMER OPERATIONS", items: [
    { label: "Customer Support", icon: Headphones },
    { label: "Customers & Packages", icon: Users },
    { label: "Orders & Payments", icon: Wallet },
  ]},
  { label: "GROWTH STUDIO", items: [
    { label: "Marketing & Social", icon: Megaphone },
    { label: "Creative Studio", icon: Palette },
    { label: "Content Calendar", icon: CalendarDays },
  ]},
  { label: "OPERATIONS", items: [
    { label: "Monitoring & Security", icon: ShieldCheck },
    { label: "Reports & Reminders", icon: FileText },
    { label: "Approvals", icon: ClipboardList },
  ]},
];

const moduleDescriptions: Record<string, { title: string; description: string; icon: typeof Bot; tasks: string[] }> = {
  "AI Command Center": { title: "Your AI workbench", description: "Describe a task in plain language. The AI planner and integrations will be enabled after configuration.", icon: Sparkles, tasks: ["Draft a Bengali campaign for an approved Home Air feature", "Summarize unresolved support tickets", "Prepare today's operations report"] },
  "Agents & Tasks": { title: "Agents & Tasks", description: "Track planned, running, failed, and approval-gated work.", icon: Bot, tasks: ["Configure Gemini API", "Define specialist-agent permissions", "Create the first scheduled report"] },
  "Customer Support": { title: "Customer Support", description: "A unified support inbox with approved answers, ticket history, and human escalation.", icon: Headphones, tasks: ["Connect Telegram bot", "Import approved FAQ knowledge", "Set escalation and response rules"] },
  "Customers & Packages": { title: "Customers & Packages", description: "Customer records and package changes will remain unavailable until the trusted data source and role policies are configured.", icon: Users, tasks: ["Choose the authoritative customer database", "Map package and subscription states", "Define support and finance permissions"] },
  "Orders & Payments": { title: "Orders & Payments", description: "Review trusted payment records and discrepancies. AI will never mark a payment as verified based only on a screenshot or customer claim.", icon: Wallet, tasks: ["Connect the verified payment data source", "Define manual-review workflow", "Set refund approval policy"] },
  "Marketing & Social": { title: "Marketing & Social", description: "Create bilingual campaigns, prepare platform-specific drafts, then approve before publishing.", icon: Megaphone, tasks: ["Confirm official Home Air social accounts", "Connect supported publishing APIs", "Prepare a 7-day content calendar"] },
  "Creative Studio": { title: "Creative Studio", description: "Build creative briefs and generate posters, thumbnails, and reel scripts in Home Air's orange-and-white identity.", icon: Film, tasks: ["Set up private asset storage", "Select image-generation provider", "Select video-generation provider"] },
  "Content Calendar": { title: "Content Calendar", description: "Plan drafts and scheduled content. No content is published until an authorized user approves it.", icon: CalendarDays, tasks: ["Connect a supported social account", "Set preferred posting windows", "Review the publishing approval policy"] },
  "Monitoring & Security": { title: "Monitoring & Security", description: "Monitor only explicitly authorized Home Air services; show sanitized health status and create incidents.", icon: ShieldCheck, tasks: ["Add approved health endpoints", "Configure alerts and rate limits", "Set backup and incident-response checks"] },
  "Reports & Reminders": { title: "Reports & Reminders", description: "Schedule daily and weekly summaries using verified sources and Asia/Dhaka timezone.", icon: FileText, tasks: ["Select report recipients", "Choose daily report time", "Connect an approved notification channel"] },
  "Approvals": { title: "Approval Queue", description: "Consequential operations require explicit human approval bound to the exact proposed action.", icon: ClipboardList, tasks: ["Define who can approve content", "Define finance-only approvals", "Require approval for production changes"] },
};

function SetupBadge() {
  return <span className="status-badge"><span className="status-dot" /> Setup required</span>;
}

type MetricSummary = {
  value: number | null;
  status: "ready" | "restricted" | "unavailable";
};

type WorkspaceSessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
};

type DashboardSummary = {
  generatedAt: string;
  source: "postgresql";
  metrics: {
    supportInbox: MetricSummary;
    customerRecords: MetricSummary;
    pendingApprovals: MetricSummary;
    scheduledContent: MetricSummary;
  };
  recentActivity: {
    status: "ready" | "restricted" | "unavailable";
    items: Array<{
      id: string;
      event_type: string;
      outcome: string;
      created_at: string;
      resource_type: string | null;
    }>;
  };
};

function StatCard({ label, note, icon: Icon, metric }: {
  label: string;
  note: string;
  icon: typeof Bot;
  metric?: MetricSummary;
}) {
  const value = metric?.status === "ready" && typeof metric.value === "number"
    ? metric.value.toLocaleString()
    : "—";
  const detail = !metric
    ? note
    : metric.status === "restricted"
      ? "Not available for your role"
      : metric.status === "unavailable"
        ? "Data source unavailable"
        : metric.value === 0
          ? "No matching records"
          : "Live database count";

  return (
    <article className="stat-card">
      <div className="stat-top"><span className="stat-label">{label}</span><span className="stat-icon"><Icon size={18} /></span></div>
      <div className="stat-value pending-value">{value}</div>
      <div className="stat-foot"><span className="muted-dot" /> {detail}</div>
    </article>
  );
}

type PlanResponse = {
  task: {
    id: string;
    title: string;
    department: string;
    status: string;
    priority: string;
    requires_approval: boolean;
    created_at: string;
  };
  plan: {
    title: string;
    department: string;
    summary: string;
    steps: string[];
    priority: string;
    riskLevel: string;
    requiresApproval: boolean;
    approvalReason: string;
    missingInputs: string[];
    executionStatus: string;
  };
  reused?: boolean;
  approval_id?: string | null;
  note: string;
};

type OfficeTask = {
  id: string;
  title: string;
  department: string;
  status: string;
  priority: string;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
};

type ApprovalItem = {
  id: string;
  task_id: string | null;
  action_type: string;
  explanation: string;
  risk_level: string;
  status: string;
  expires_at: string;
  created_at: string;
  task: { title: string; department: string; priority: string } | null;
  review: { title: string; summary: string; steps: string[]; approvalReason: string; missingInputs: string[] };
};

function PlanPanel({ result }: { result: PlanResponse }) {
  return (
    <section className="plan-result" aria-live="polite">
      <div className="plan-result-head">
        <div><span className="eyebrow">AI PLAN SAVED</span><h3>{result.plan.title}</h3></div>
        <span className={"risk-chip risk-" + result.plan.riskLevel}>{result.plan.riskLevel} risk</span>
      </div>
      <p className="plan-summary">{result.plan.summary}</p>
      <div className="plan-meta"><span>Task {result.task.id.slice(0, 8)}</span><span>{result.task.department}</span><span>{result.reused ? "Existing request" : "Saved and audited"}</span></div>
      {result.task.requires_approval && <p className="module-note"><LockKeyhole size={15}/><span>{result.approval_id ? "A human review request was recorded. Open Approvals to review it. Approval records the decision only; no external action is executed." : "This plan requires human review. Apply the task/approval migration to create an approval record. No external action is executed."}</span></p>}
      <h4>Proposed steps</h4>
      <ol className="plan-steps">{result.plan.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
      {result.plan.requiresApproval && <div className="plan-approval"><LockKeyhole size={16}/><div><strong>Human approval required before consequential actions</strong><p>{result.plan.approvalReason || "Review the plan before carrying out any external action."}</p></div></div>}
      {result.plan.missingInputs.length > 0 && <div className="missing-inputs"><strong>Inputs to confirm</strong><ul>{result.plan.missingInputs.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      <p className="plan-no-action"><ShieldCheck size={14}/>{result.note}</p>
    </section>
  );
}

export default function OfficeDashboard() {
  const router = useRouter();
  const [active, setActive] = useState("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [command, setCommand] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandError, setCommandError] = useState("");
  const [commandResult, setCommandResult] = useState<PlanResponse | null>(null);
  const [session, setSession] = useState<WorkspaceSessionUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessionNotice, setSessionNotice] = useState("");
  const [officeTasks, setOfficeTasks] = useState<OfficeTask[]>([]);
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [workflowRefresh, setWorkflowRefresh] = useState(0);

  useEffect(() => {
    let mounted = true;

    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { user: WorkspaceSessionUser };
        if (mounted && payload.user) setSession(payload.user);
      })
      .catch(() => {
        // Setup mode intentionally remains usable when authentication is not configured.
      });

    void fetch("/api/dashboard/summary", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as DashboardSummary;
        if (mounted) setSummary(payload);
      })
      .catch(() => {
        // Unavailable integrations remain visibly unconfigured rather than fabricated.
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (active !== "Agents & Tasks" && active !== "Approvals") return;
    let mounted = true;
    const endpoint = active === "Agents & Tasks" ? "/api/tasks?limit=50" : "/api/approvals?status=pending&limit=50";
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { tasks?: OfficeTask[]; approvals?: ApprovalItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load workflow records.");
        if (!mounted) return;
        if (active === "Agents & Tasks") setOfficeTasks(payload.tasks ?? []);
        else setApprovalItems(payload.approvals ?? []);
      })
      .catch((error: unknown) => {
        if (mounted) setWorkflowError(error instanceof Error ? error.message : "Workflow data is unavailable.");
      })
      .finally(() => { if (mounted) setWorkflowLoading(false); });
    return () => { mounted = false; };
  }, [active, workflowRefresh]);

  async function decideApproval(id: string, decision: "approve" | "reject") {
    const verb = decision === "approve" ? "approve this review request" : "reject this review request";
    if (!window.confirm(`Are you sure you want to ${verb}? This only records a review decision; it will not execute the proposed action.`)) return;
    setWorkflowError("");
    setWorkflowNotice("");
    try {
      const response = await fetch(`/api/approvals/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not record the decision.");
      setWorkflowNotice(payload.message || "Decision recorded. No external action was executed.");
      setWorkflowLoading(true);
      setWorkflowRefresh((value) => value + 1);
      setSummary(null);
      void fetch("/api/dashboard/summary", { cache: "no-store" }).then(async (res) => {
        if (res.ok) setSummary(await res.json() as DashboardSummary);
      }).catch(() => {});
    } catch (error) {
      setWorkflowError(error instanceof Error ? error.message : "Could not record the decision.");
    }
  }

  async function handleSignOut() {
    setSessionNotice("");
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        setSessionNotice("Unable to sign out right now. Please retry.");
        return;
      }
      router.push("/login");
    } catch {
      setSessionNotice("Unable to reach the sign-out service. Please retry.");
    }
  }

  const allItems = useMemo(() => navGroups.flatMap((group) => group.items.map((item) => item.label)), []);
  const activeModule = moduleDescriptions[active];
  const ModuleIcon = activeModule?.icon ?? Settings2;
  const suggestions = activeModule?.tasks ?? [
    "Add your Gemini API key through your deployment environment",
    "Connect Supabase for authentication and the PostgreSQL database",
    "Connect the Telegram support bot after setting its webhook secret",
  ];
  const matchingItems = allItems.filter((item) => item.toLowerCase().includes(query.toLowerCase()));

  async function submitCommand() {
    const prompt = command.trim();
    if (prompt.length < 3 || commandLoading) return;
    setCommandLoading(true);
    setCommandError("");
    setCommandResult(null);
    try {
      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ prompt }),
      });
      const payload = await response.json() as PlanResponse & { error?: string };
      if (!response.ok) {
        setCommandError(payload.error || "The task could not be planned. Check authentication and service configuration.");
        return;
      }
      setCommandResult(payload);
      setActive("AI Command Center");
    } catch {
      setCommandError("Could not reach the AI planning service. Check the deployment and try again.");
    } finally {
      setCommandLoading(false);
    }
  }

  const refreshWorkflow = () => {
    setWorkflowLoading(true);
    setWorkflowError("");
    setWorkflowNotice("");
    setWorkflowRefresh((value) => value + 1);
  };

  const selectNav = (label: string) => {
    if (label === "Agents & Tasks" || label === "Approvals") {
      setWorkflowLoading(true);
      setWorkflowError("");
      setWorkflowNotice("");
    }
    setActive(label);
    setMobileNavOpen(false);
    setQuery("");
  };

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={"sidebar " + (mobileNavOpen ? "sidebar-open" : "")}>
        <div className="brand-row">
          <div className="brand-mark"><span className="brand-play" /></div>
          <div className="brand-copy"><strong>Home Air</strong><span>AI OFFICE</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close sidebar"><X size={18}/></button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">HA</div>
          <div className="workspace-info"><strong>Home Air Workspace</strong><span>{session ? session.role.replace(/_/g, " ") : "Setup preview"}</span></div>
          <ChevronDown size={15} className="muted-icon"/>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-caption">{group.label}</p>
              {group.items.map(({ label, icon: Icon }) => (
                <button key={label} className={"nav-item " + (active === label ? "nav-item-active" : "")} onClick={() => selectNav(label)}>
                  <Icon size={17} strokeWidth={1.8}/><span>{label}</span>{label === "Approvals" && <span className="nav-mini-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-mini"><ShieldCheck size={17}/><div><strong>{session ? "Authenticated workspace" : "Security setup pending"}</strong><span>{session ? "Sensitive actions remain approval-gated" : "No admin actions enabled"}</span></div></div>
          <button className={"nav-item " + (active === "Settings" ? "nav-item-active" : "")} onClick={() => selectNav("Settings")}><Settings2 size={17}/><span>Settings & Integrations</span></button>
          <div className="sidebar-profile">
            <div className="profile-avatar">HA</div><div className="profile-name"><strong>{session?.displayName || session?.email || "Admin account"}</strong><span>{session ? session.role.replace(/_/g, " ") : "Authentication not configured"}</span></div><CircleHelp size={16} className="muted-icon"/>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
            <div className="breadcrumb"><span>Home Air Office</span><ChevronRight size={14}/><strong>{active}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16}/><input aria-label="Search modules" placeholder="Search workspace..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            {query && <div className="search-results">{matchingItems.slice(0, 5).map((item) => <button key={item} onClick={() => selectNav(item)}>{item}</button>)}{matchingItems.length === 0 && <span>No matching pages</span>}</div>}
            {sessionNotice && <span className="command-error" role="alert">{sessionNotice}</span>}
            <button className="icon-button notification-button" aria-label="Notifications" title="Notifications are not configured"><Bell size={18}/><span /></button>
            {session && <button className="icon-button" onClick={() => void handleSignOut()} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button>}
            <div className="topbar-avatar">HA</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line"/> OPERATIONS OVERVIEW</div><h1>{active === "Overview" ? "Good to have you here." : activeModule?.title ?? active}</h1><p className="page-subtitle">{active === "Overview" ? "Your Home Air operations, coordinated in one intelligent workspace." : activeModule?.description ?? "Manage your Home Air workspace configuration and connected services."}</p></div>
            <div className="welcome-actions"><SetupBadge/><button className="button button-primary" onClick={() => { setActive("AI Command Center"); setCommand(""); setCommandError(""); setCommandResult(null); }}><Plus size={16}/> New task</button></div>
          </div>

          <section className="setup-alert">
            <div className="alert-icon"><AlertTriangle size={18}/></div>
            <div className="alert-copy"><strong>{session ? "Integration setup is not complete" : "Workspace setup is not complete"}</strong><p>{session ? `Signed in as ${session.email || session.displayName || "an authorized user"}. Real customer/payment operations and external publishing remain disabled until their providers, approval workflows, and audit paths are verified.` : "This repository has been bootstrapped. Connect authentication and the database before adding real customer or payment data."}</p></div>
            <button className="text-button" onClick={() => setShowSetup((value) => !value)}>{showSetup ? "Hide checklist" : "View checklist"} <ChevronRight size={15}/></button>
          </section>

          {showSetup && <section className="setup-checklist card-surface"><div className="section-heading"><div><h2>First-time setup</h2><p>Complete these steps before production use.</p></div><LockKeyhole size={20}/></div><div className="checklist-grid">{[
            ["1", "Create Supabase project", "Database, email/password authentication and role policies."],
            ["2", "Set server credentials", "Configure Gemini and Supabase keys as deployment secrets, never in Git."],
            ["3", "Add verified owner account", "Create the first account manually and grant the minimum owner role."],
            ["4", "Connect support integrations", "Add Telegram only after authentication, authorization and audit tests pass."],
          ].map(([number, title, description]) => <div className="checklist-item" key={number}><span className="check-number">{number}</span><div><strong>{title}</strong><p>{description}</p></div></div>)}</div></section>}

          {active === "Overview" ? (
            <>
              <div className="section-heading metrics-heading"><div><h2>Workspace health</h2><p>Live metrics appear after trusted sources are connected.</p></div><span className="live-label"><span/> Connection status</span></div>
              <div className="stats-grid">
                <StatCard label="Support inbox" note="Connect support source" icon={MessageSquare} metric={summary?.metrics.supportInbox}/>
                <StatCard label="Customer records" note="Database not connected" icon={Users} metric={summary?.metrics.customerRecords}/>
                <StatCard label="Pending approvals" note="Approval service not enabled" icon={ClipboardList} metric={summary?.metrics.pendingApprovals}/>
                <StatCard label="Scheduled content" note="Publishing not connected" icon={Megaphone} metric={summary?.metrics.scheduledContent}/>
              </div>

              <div className="content-grid">
                <section className="card-surface command-card">
                  <div className="card-header"><div className="card-icon orange-icon"><Sparkles size={18}/></div><div><h2>AI Command Center</h2><p>Describe what you need done</p></div><span className="soon-badge">Setup required</span></div>
                  <div className="command-entry"><textarea aria-label="Describe a task" value={command} onChange={(event) => setCommand(event.target.value)} maxLength={2000} placeholder="e.g. Prepare a Bengali Home Air feature announcement and a 9:16 reel script..." rows={3} /><button className="send-button" type="button" aria-label="Create AI plan" disabled={commandLoading || command.trim().length < 3} onClick={() => void submitCommand()} title="Generate and save a plan only"><Send size={17}/></button></div>
                  <div className="command-foot"><span><LockKeyhole size={13}/> This creates a plan only. It does not publish, message, change customer/payment records, or deploy.</span></div>{commandError && <p className="command-error" role="alert">{commandError}</p>}{commandResult && <PlanPanel result={commandResult} />}
                  <div className="suggestion-list">{["Draft a 7-day marketing plan", "Summarize open support issues", "Prepare daily operations report"].map((suggestion) => <button key={suggestion} onClick={() => { setCommand(suggestion); setCommandError(""); setCommandResult(null); setActive("AI Command Center"); }}><span>{suggestion}</span><ArrowUpRight size={14}/></button>)}</div>
                </section>

                <section className="card-surface readiness-card">
                  <div className="section-heading"><div><h2>Integration readiness</h2><p>Required providers to configure</p></div><Plug size={18} className="muted-icon"/></div>
                  <div className="integration-list">{[
                    ["Supabase", "Auth + PostgreSQL", "Required", Users],
                    ["Gemini API", "AI task orchestration", "Required", Sparkles],
                    ["Telegram", "Customer support bot", "Optional", Headphones],
                    ["Media provider", "Image & video generation", "Optional", Film],
                  ].map(([name, description, status, IconComponent]) => { const IntegrationIcon = IconComponent as typeof Bot; return <div className="integration-row" key={name as string}><span className="integration-icon"><IntegrationIcon size={17}/></span><div className="integration-info"><strong>{name as string}</strong><span>{description as string}</span></div><span className={status === "Required" ? "small-status status-required" : "small-status"}>{status as string}</span></div>; })}
                  </div>
                  <button className="button button-secondary full-button" onClick={() => setShowSetup(true)}>Open setup checklist <ChevronRight size={15}/></button>
                </section>
              </div>

              <div className="bottom-grid">
                <section className="card-surface">
                  <div className="section-heading"><div><h2>Work queue</h2><p>Recommended setup steps</p></div><ClipboardList size={18} className="muted-icon"/></div>
                  <div className="queue-list">{[
                    ["Configure secure authentication", "Foundation", "High"],
                    ["Choose the authoritative customer database", "Customer operations", "High"],
                    ["Add the Gemini server-side API key", "AI command center", "Medium"],
                  ].map(([title, category, priority]) => <div className="queue-item" key={title}><span className="queue-check"><Check size={13}/></span><div className="queue-copy"><strong>{title}</strong><span>{category}</span></div><span className={"priority priority-" + priority.toLowerCase()}>{priority}</span></div>)}</div>
                </section>
                <section className="card-surface activity-card">
                  <div className="section-heading"><div><h2>Recent activity</h2><p>Latest authorized audit events</p></div><Activity size={18} className="muted-icon"/></div>
                  {!summary || summary.recentActivity.status === "unavailable" ? (
                    <div className="empty-activity"><div className="empty-icon"><Clock3 size={20}/></div><strong>Activity unavailable</strong><p>Connect the database and apply the current migration to load verified audit events.</p></div>
                  ) : summary.recentActivity.status === "restricted" ? (
                    <div className="empty-activity"><div className="empty-icon"><LockKeyhole size={20}/></div><strong>Audit access restricted</strong><p>Your role does not have permission to view the audit trail.</p></div>
                  ) : summary.recentActivity.items.length === 0 ? (
                    <div className="empty-activity"><div className="empty-icon"><Clock3 size={20}/></div><strong>No activity recorded yet</strong><p>Audited workspace events will appear here when they occur.</p></div>
                  ) : (
                    <div className="queue-list">
                      {summary.recentActivity.items.map((event) => (
                        <div className="queue-item" key={event.id}>
                          <span className="queue-check"><Activity size={13}/></span>
                          <div className="queue-copy">
                            <strong>{event.event_type.replace(/[._]/g, " ")}</strong>
                            <span>{[event.resource_type, event.outcome].filter(Boolean).join(" · ")} · {new Date(event.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <section className="module-page card-surface">
              <div className="module-banner"><div className="module-banner-icon"><ModuleIcon size={25}/></div><div><span className="eyebrow">HOME AIR DEPARTMENT</span><h2>{activeModule?.title ?? active}</h2><p>{activeModule?.description ?? "Workspace and integration settings will be configured here."}</p></div></div>
              {active === "AI Command Center" && <section className="ai-plan-workbench">
                <form onSubmit={(event) => { event.preventDefault(); void submitCommand(); }}>
                  <label htmlFor="module-command">Describe the task you want Home Air AI Office to plan</label>
                  <textarea id="module-command" value={command} onChange={(event) => setCommand(event.target.value)} maxLength={2000} rows={4} placeholder="Example: Prepare a seven-day Bengali and English campaign for a verified Home Air app update. Include post captions, a 9:16 reel script, and review steps." />
                  <div className="workbench-footer"><span>Maximum 2,000 characters · Planning only · No external action</span><button className="button button-primary" type="submit" disabled={commandLoading || command.trim().length < 3}>{commandLoading ? "Planning..." : "Generate plan"} <Sparkles size={15}/></button></div>
                </form>
                {commandError && <p className="command-error" role="alert">{commandError}</p>}
                {commandResult && <PlanPanel result={commandResult}/>}
              </section>}
              {active === "Agents & Tasks" && <section className="workflow-panel">
                <div className="section-heading"><div><h2>Saved task plans</h2><p>Latest tasks from the Supabase office database</p></div><button className="button button-secondary" onClick={refreshWorkflow}>Refresh</button></div>
                {workflowLoading ? <p className="workflow-empty">Loading task records…</p> : workflowError ? <p className="command-error" role="alert">{workflowError}</p> : officeTasks.length === 0 ? <div className="workflow-empty"><strong>No saved tasks yet</strong><p>Use AI Command Center to generate and save a plan. This list never claims a plan has executed.</p></div> : <div className="workflow-list">{officeTasks.map((task) => <article className="workflow-item" key={task.id}><div className="workflow-item-main"><strong>{task.title}</strong><span>{task.department} · {new Date(task.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span></div><div className="workflow-item-tags"><span className={"priority priority-" + task.priority}>{task.priority}</span><span className="workflow-status">{task.status.replace(/_/g, " ")}</span>{task.requires_approval && <span className="workflow-status">Review required</span>}</div></article>)}</div>}
              </section>}
              {active === "Approvals" && <section className="workflow-panel">
                <div className="section-heading"><div><h2>Pending review requests</h2><p>Decisions are audited. No action executes from this queue.</p></div><button className="button button-secondary" onClick={() => setWorkflowRefresh((value) => value + 1)}>Refresh</button></div>
                {workflowNotice && <p className="workflow-notice" role="status">{workflowNotice}</p>}
                {workflowLoading ? <p className="workflow-empty">Loading approval requests…</p> : workflowError ? <p className="command-error" role="alert">{workflowError}</p> : approvalItems.length === 0 ? <div className="workflow-empty"><strong>No pending review requests</strong><p>Plans marked for human review will appear here after the latest database migration is applied.</p></div> : <div className="workflow-list">{approvalItems.map((item) => <article className="workflow-item approval-workflow-item" key={item.id}><div className="workflow-item-main"><strong>{item.review.title || item.task?.title || item.action_type.replace(/[._]/g, " ")}</strong><span>{item.explanation}</span>{item.review.summary && <span>{item.review.summary}</span>}{item.review.approvalReason && <span>Review reason: {item.review.approvalReason}</span>}{item.review.steps.length > 0 && <ol className="approval-review-steps">{item.review.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}<span>Risk: {item.risk_level} · Expires {new Date(item.expires_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span></div>{session && ["owner", "administrator", "finance_reviewer"].includes(session.role) ? <div className="workflow-item-actions"><button className="button button-secondary" onClick={() => void decideApproval(item.id, "reject")}>Reject</button><button className="button button-primary" onClick={() => void decideApproval(item.id, "approve")}>Approve review</button></div> : <span className="workflow-status">View only</span>}</article>)}</div>}
                <p className="module-note"><LockKeyhole size={15}/><span>Approval means a human reviewed this plan; it does not publish content, send messages, modify customer/payment records, deploy code, or run an agent.</span></p>
              </section>}
              <div className="section-heading"><div><h2>Recommended next steps</h2><p>These setup tasks are guidance, not completed work.</p></div></div>
              <div className="module-tasks">{suggestions.map((task, index) => <div className="module-task" key={task}><span className="task-index">{String(index + 1).padStart(2, "0")}</span><span>{task}</span><SetupBadge/></div>)}</div>
              <div className="module-note"><LockKeyhole size={16}/><span>This module is in setup mode. Real operations remain disabled until authentication, role permissions, data sources, and required integrations have been implemented and verified.</span></div>
            </section>
          )}

          <footer className="footer"><span>© {new Date().getFullYear()} Home Air · AI Office</span><span><ShieldCheck size={13}/> {session ? "Authenticated workspace" : "Setup preview"} <span className="footer-separator">·</span> Asia/Dhaka</span></footer>
        </div>
      </main>
    </div>
  );
}
