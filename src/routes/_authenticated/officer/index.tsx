import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarIcon, CheckCircle2, Clock, FileText, Flame, TrendingUp, Users, Activity, ShieldAlert } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, RANK_LABEL } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { format, subDays, startOfDay, startOfMonth, subMonths } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/_authenticated/officer/")({ component: Page });

const COLORS = ["var(--primary)", "var(--brand)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--accent-foreground)"];
const SENIOR = new Set(["tahsildar", "rdo", "collector"]);
const WB_TYPES = ["All types", "River", "Lake/Tank", "Lake/Tank/Wetland", "Dam/Reservoir", "Waterfall"];

function Page() {
  const { profile } = useAuth();
  const rank = profile?.officer_rank ?? null;
  const isSenior = rank ? SENIOR.has(rank) : false;
  const isCollector = rank === "collector";
  const qc = useQueryClient();

  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [wbTypeFilter, setWbTypeFilter] = useState<string>("All types");
  const [range, setRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 29), to: new Date() });

  const { data } = useQuery({
    queryKey: ["officer-home", rank],
    enabled: !!rank,
    queryFn: async () => {
      let q = supabase.from("complaints").select("*, water_bodies(name,type), districts(name)");
      if (rank === "vao") q = q.eq("current_rank", "vao");
      else if (rank === "tahsildar" || rank === "rdo") q = q.gt("escalation_level", 0);
      const r = await q.order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["officer-meta"],
    queryFn: async () => {
      const [w, d, officers] = await Promise.all([
        supabase.from("water_bodies").select("id,risk_level", { count: "exact" }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).not("officer_rank", "is", null),
      ]);
      const highRisk = (w.data ?? []).filter((x: any) => x.risk_level === "high" || x.risk_level === "critical").length;
      return { waterBodies: w.count ?? 0, highRisk, districts: d.count ?? 0, officers: officers.count ?? 0 };
    },
  });

  const { data: districts } = useQuery({
    queryKey: ["officer-districts-list"],
    queryFn: async () => (await supabase.from("districts").select("id,name").order("name")).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel("officer-home").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["officer-home"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const allArr = data ?? [];
  const arr = useMemo(() => {
    return allArr.filter((c: any) => {
      if (districtFilter !== "all" && c.districts?.name !== districtFilter) return false;
      if (wbTypeFilter !== "All types" && c.water_bodies?.type !== wbTypeFilter) return false;
      if (range?.from && new Date(c.created_at) < startOfDay(range.from)) return false;
      if (range?.to && new Date(c.created_at) > new Date(range.to.getTime() + 86_400_000 - 1)) return false;
      return true;
    });
  }, [allArr, districtFilter, wbTypeFilter, range]);
  const now = Date.now();

  const analytics = useMemo(() => {
    const resolved = arr.filter((c: any) => c.status === "resolved").length;
    const breached = arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now).length;
    const active = arr.length - resolved;
    const escalated = arr.filter((c: any) => (c.escalation_level ?? 0) > 0 || c.current_rank !== "vao").length;
    const critical = arr.filter((c: any) => c.severity === "critical" || c.severity === "high").length;
    const compliance = arr.length === 0 ? 100 : Math.round(((arr.length - breached) / arr.length) * 100);
    const approaching = arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() - now <= 24 * 3600 * 1000 && new Date(c.sla_deadline).getTime() > now).length;
    const critical36 = arr.filter((c: any) => {
      if (c.status === "resolved") return false;
      const age = now - new Date(c.created_at).getTime();
      return age >= 36 * 3600 * 1000 && new Date(c.sla_deadline).getTime() >= now;
    }).length;

    const byWaterBody = Object.values(arr.reduce((acc: any, c: any) => { const name = c.water_bodies?.name ?? "Unknown"; (acc[name] ??= { name, value: 0 }).value++; return acc; }, {})) as any[];
    const escalationTrend: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) escalationTrend[format(subMonths(new Date(), i), "MMM")] = 0;
    arr.forEach((c: any) => {
      if ((c.escalation_level ?? 0) > 0 || c.current_rank !== "vao") {
        const k = format(startOfMonth(new Date(c.created_at)), "MMM");
        if (k in escalationTrend) escalationTrend[k]++;
      }
    });

    const daily: Record<string, { filed: number; resolved: number; breached: number }> = {};
    for (let i = 29; i >= 0; i--) daily[format(subDays(new Date(), i), "MMM d")] = { filed: 0, resolved: 0, breached: 0 };
    arr.forEach((c: any) => {
      const key = format(startOfDay(new Date(c.created_at)), "MMM d");
      if (daily[key]) daily[key].filed++;
      if (c.resolved_at) {
        const rk = format(startOfDay(new Date(c.resolved_at)), "MMM d");
        if (daily[rk]) daily[rk].resolved++;
      }
      if (c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now && daily[key]) daily[key].breached++;
    });

    const months: Record<string, { filed: number; resolved: number }> = {};
    for (let i = 5; i >= 0; i--) months[format(subMonths(new Date(), i), "MMM yy")] = { filed: 0, resolved: 0 };
    arr.forEach((c: any) => {
      const k = format(startOfMonth(new Date(c.created_at)), "MMM yy");
      if (months[k]) months[k].filed++;
      if (c.resolved_at) {
        const rk = format(startOfMonth(new Date(c.resolved_at)), "MMM yy");
        if (months[rk]) months[rk].resolved++;
      }
    });

    const byDistrictMap: Record<string, { name: string; filed: number; resolved: number; breached: number; risk: number }> = {};
    arr.forEach((c: any) => {
      const name = c.districts?.name ?? "Unknown";
      const item = (byDistrictMap[name] ??= { name, filed: 0, resolved: 0, breached: 0, risk: 0 });
      item.filed++;
      if (c.status === "resolved") item.resolved++;
      if (c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now) item.breached++;
    });
    const byDistrict = Object.values(byDistrictMap).map((d) => ({ ...d, risk: d.filed ? Math.round(((d.breached * 2 + (d.filed - d.resolved)) / (d.filed * 3)) * 100) : 0 })).sort((a, b) => b.risk - a.risk);

    const bySeverity = Object.values(arr.reduce((acc: any, c: any) => { (acc[c.severity] ??= { name: c.severity, value: 0 }).value++; return acc; }, {})) as any[];
    const byType = Object.values(arr.reduce((acc: any, c: any) => { const name = String(c.type).replace(/_/g, " "); (acc[name] ??= { name, value: 0 }).value++; return acc; }, {})) as any[];

    return {
      resolved, breached, active, escalated, critical, critical36, compliance, approaching,
      daily: Object.entries(daily).map(([day, v]) => ({ day, ...v })),
      months: Object.entries(months).map(([month, v]) => ({ month, ...v })),
      byDistrict, bySeverity, byType, byWaterBody,
      escalationTrend: Object.entries(escalationTrend).map(([month, value]) => ({ month, value })),
    };
  }, [arr, now]);

  if (!isSenior) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Authority Dashboard</h1>
          <p className="text-sm text-muted-foreground">{rank ? RANK_LABEL[rank] : ""} — live queue scoped to your action stage.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[{ l: "Assigned", v: arr.length }, { l: "Active", v: analytics.active }, { l: "Overdue", v: analytics.breached }, { l: "Critical", v: analytics.critical }].map((s) => (
            <div key={s.l} className="rounded-xl border bg-card p-5 shadow-card"><div className="text-sm text-muted-foreground">{s.l}</div><div className="mt-2 text-3xl font-bold">{s.v}</div></div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between"><div className="font-semibold">Most Urgent</div><Link to="/officer/queue" className="text-xs text-primary hover:underline">Open queue</Link></div>
          <div className="space-y-2">
            {arr.filter((c: any) => c.status !== "resolved").sort((a: any, b: any) => new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()).slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name} · {c.districts?.name}</span></div>
                <SlaCountdown deadline={c.sla_deadline} />
              </div>
            ))}
            {arr.length === 0 && <div className="text-sm text-muted-foreground">No actionable complaints at this stage.</div>}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Complaints", value: arr.length, note: `${analytics.compliance}% compliant`, icon: FileText, tone: "bg-primary/10 text-primary" },
    { label: "Active Cases", value: analytics.active, note: "Currently ongoing", icon: Activity, tone: "bg-warning/20 text-warning-foreground" },
    { label: "Resolved", value: analytics.resolved, note: "Successfully closed", icon: CheckCircle2, tone: "bg-success/15 text-success" },
    { label: "SLA Breached", value: analytics.breached, note: "> 48 hours", icon: AlertTriangle, tone: "bg-destructive/15 text-destructive" },
    { label: "Escalated", value: analytics.escalated, note: "Moved up workflow", icon: Flame, tone: "bg-destructive/10 text-destructive" },
    { label: "Officers on Duty", value: meta?.officers ?? 0, note: "Across departments", icon: Users, tone: "bg-brand/15 text-brand" },
    { label: "Critical Complaints", value: analytics.critical, note: "High priority", icon: ShieldAlert, tone: "bg-destructive/15 text-destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{rank ? RANK_LABEL[rank] : "Authority"} Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            BlueGeo AI · {isCollector ? "Full district view" : rank === "rdo" ? "Division-wide view" : "Taluk-wide view"} · Tamil Nadu
          </p>
        </div>
        <div className="rounded-full border border-success/30 bg-success/10 px-4 py-1.5 text-xs font-semibold text-success">● Live Monitoring</div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-card">
        <span className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</span>
        <Select value={districtFilter} onValueChange={setDistrictFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="District" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All districts</SelectItem>
            {(districts ?? []).map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={wbTypeFilter} onValueChange={setWbTypeFilter}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Water body type" /></SelectTrigger>
          <SelectContent>{WB_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 justify-start text-left font-normal", !range && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {range?.from ? (range.to ? `${format(range.from, "LLL d")} – ${format(range.to, "LLL d, y")}` : format(range.from, "LLL d, y")) : "Pick a date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(districtFilter !== "all" || wbTypeFilter !== "All types") && (
          <Button variant="ghost" size="sm" onClick={() => { setDistrictFilter("all"); setWbTypeFilter("All types"); }}>Reset</Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">Showing <span className="font-semibold text-foreground">{arr.length}</span> of {allArr.length} complaints</div>
      </div>

      {/* Top Alert Section */}
      <div className="grid gap-3 md:grid-cols-3">
        <AlertBanner tone="red" count={analytics.breached} title="SLA Breached" subtitle="Past 48 hours — escalate now" href="/officer/ai-alerts" />
        <AlertBanner tone="orange" count={analytics.critical36} title="Critical Complaints" subtitle="Over 36 hours old · urgent" href="/officer/queue" />
        <AlertBanner tone="yellow" count={analytics.approaching} title="Approaching SLA" subtitle="Within 24 hours · act soon" href="/officer/queue" />
      </div>

      {/* KPI Cards — uniform row */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated">
            <div className="flex items-center justify-between gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="h-4 w-4" /></div>
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            </div>
            <div className="mt-3 text-2xl font-bold leading-none">{s.value}</div>
            <div className="mt-1.5 text-xs font-medium text-foreground/80">{s.label}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </div>

      {/* Analytics Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Day-wise Complaints" subtitle="Last 30 days">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={analytics.daily}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={3} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="filed" stroke="var(--primary)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" stroke="var(--success)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="breached" stroke="var(--destructive)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Month-wise Complaints" subtitle="Filed vs resolved · last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.months}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="filed" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="District-wise" subtitle="Top 8 by volume" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.byDistrict.slice(0, 8)} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="resolved" stackId="a" fill="var(--success)" />
              <Bar dataKey="filed" stackId="a" fill="var(--warning)" />
              <Bar dataKey="breached" stackId="a" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Water Body-wise" subtitle="Top 6">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={analytics.byWaterBody.slice(0, 6)} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40} paddingAngle={2}>
                {analytics.byWaterBody.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="SLA Compliance" subtitle="Resolved within 48 hours">
          <div className="flex h-[260px] flex-col items-center justify-center">
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--success)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(analytics.compliance / 100) * 263.9} 263.9`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold">{analytics.compliance}%</div>
                <div className="text-xs text-muted-foreground">compliant</div>
              </div>
            </div>
            <div className="mt-4 flex gap-6 text-xs">
              <div><span className="font-bold text-success">{analytics.resolved}</span> resolved</div>
              <div><span className="font-bold text-destructive">{analytics.breached}</span> breached</div>
            </div>
          </div>
        </Panel>
        <Panel title="Escalation Trends" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.escalationTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Water Body Risk" subtitle="Top 5 districts">
          <div className="space-y-3">
            {analytics.byDistrict.slice(0, 5).map((d) => <RiskRow key={d.name} label={d.name} value={d.risk} detail={`${d.filed} filed · ${d.breached} breached`} />)}
            {analytics.byDistrict.length === 0 && <div className="text-sm text-muted-foreground">No data.</div>}
          </div>
        </Panel>
      </div>

      <Panel title="Recent Activity" subtitle="Latest complaint updates">
        <div className="space-y-2">
          {arr.slice(0, 8).map((c: any) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name} · {c.districts?.name}</span><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Stage: {c.current_rank}</span></div>
              <SlaCountdown deadline={c.sla_deadline} resolved={c.status === "resolved"} />
            </div>
          ))}
          {arr.length === 0 && <div className="rounded-xl bg-muted/30 p-6 text-center text-sm text-muted-foreground">No complaints match the current filters.</div>}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function AlertBanner({ tone, count, title, subtitle, href }: { tone: "red" | "orange" | "yellow"; count: number; title: string; subtitle: string; href: string }) {
  const styles = {
    red: "border-destructive/40 bg-destructive/10 text-destructive",
    orange: "border-warning/50 bg-warning/15 text-warning-foreground",
    yellow: "border-warning/30 bg-warning/10 text-warning-foreground",
  }[tone];
  const dot = { red: "bg-destructive", orange: "bg-warning", yellow: "bg-warning/70" }[tone];
  return (
    <Link to={href} className={cn("group flex items-center justify-between gap-3 rounded-xl border p-4 shadow-card transition-shadow hover:shadow-elevated", styles)}>
      <div className="flex items-center gap-3">
        <span className={cn("h-2.5 w-2.5 animate-pulse rounded-full", dot)} />
        <div>
          <div className="text-xs font-medium uppercase tracking-wide opacity-80">{title}</div>
          <div className="text-xs opacity-80">{subtitle}</div>
        </div>
      </div>
      <div className="text-3xl font-bold tabular-nums">{count}</div>
    </Link>
  );
}

function RiskRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{value}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-primary" style={{ width: `${Math.max(value, 5)}%` }} /></div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
