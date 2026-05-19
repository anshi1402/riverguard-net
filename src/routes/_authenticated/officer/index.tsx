import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Droplets, FileText, Flame, MapPin, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, RANK_LABEL } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { format, subDays, startOfDay, startOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/officer/")({ component: Page });

const COLORS = ["var(--primary)", "var(--brand)", "var(--success)", "var(--warning)", "var(--destructive)", "var(--accent-foreground)"];
const SENIOR = new Set(["tahsildar", "rdo", "collector"]);

function Page() {
  const { profile } = useAuth();
  const rank = profile?.officer_rank ?? null;
  const isSenior = rank ? SENIOR.has(rank) : false;
  const isCollector = rank === "collector";
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["officer-home", rank],
    enabled: !!rank,
    queryFn: async () => {
      let q = supabase.from("complaints").select("*, water_bodies(name), districts(name)");
      if (rank === "wrd") q = q.in("type", ["water_flow_obstruction", "supply_channel", "surplus_channel"]);
      else if (!isSenior) q = q.eq("current_rank", rank as string);
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

  useEffect(() => {
    const ch = supabase.channel("officer-home").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["officer-home"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const arr = data ?? [];
  const now = Date.now();

  const analytics = useMemo(() => {
    const resolved = arr.filter((c: any) => c.status === "resolved").length;
    const breached = arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now).length;
    const active = arr.length - resolved;
    const escalated = arr.filter((c: any) => (c.escalation_level ?? 0) > 0 || c.current_rank !== "vao").length;
    const critical = arr.filter((c: any) => c.severity === "critical" || c.severity === "high").length;
    const compliance = arr.length === 0 ? 100 : Math.round(((arr.length - breached) / arr.length) * 100);
    const approaching = arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() - now <= 24 * 3600 * 1000 && new Date(c.sla_deadline).getTime() > now).length;

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

    return { resolved, breached, active, escalated, critical, compliance, approaching, daily: Object.entries(daily).map(([day, v]) => ({ day, ...v })), months: Object.entries(months).map(([month, v]) => ({ month, ...v })), byDistrict, bySeverity, byType };
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
    { label: "Total Complaints", value: arr.length, note: "View all", icon: FileText, tone: "bg-primary/10 text-primary" },
    { label: "Active Cases", value: analytics.active, note: "Ongoing", icon: Clock, tone: "bg-warning/20 text-warning-foreground" },
    { label: "Resolved", value: analytics.resolved, note: `${analytics.compliance}% compliant`, icon: CheckCircle2, tone: "bg-success/15 text-success" },
    { label: "SLA Breached", value: analytics.breached, note: "> 48 hours", icon: AlertTriangle, tone: "bg-destructive/15 text-destructive" },
    { label: "Escalated", value: analytics.escalated, note: "Workflow cases", icon: Flame, tone: "bg-destructive/10 text-destructive" },
    { label: "Officers", value: meta?.officers ?? 0, note: "Available", icon: Users, tone: "bg-brand/15 text-brand" },
    { label: "Critical Complaints", value: analytics.critical, note: "High priority", icon: AlertTriangle, tone: "bg-destructive/15 text-destructive" },
    { label: "High-Risk Water Bodies", value: meta?.highRisk ?? 0, note: "Watch list", icon: Droplets, tone: "bg-accent text-accent-foreground" },
    { label: "Districts Covered", value: meta?.districts ?? 0, note: isCollector ? "Statewide" : "Pilot overview", icon: MapPin, tone: "bg-primary/10 text-primary" },
    { label: "SLA Compliance", value: `${analytics.compliance}%`, note: "Current rate", icon: TrendingUp, tone: "bg-success/15 text-success" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">{rank ? RANK_LABEL[rank] : "Authority"} Dashboard</h1>
          <p className="mt-1 text-muted-foreground">BlueGeo AI — Water Body Protection System, Tamil Nadu</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden h-11 min-w-72 items-center rounded-xl border bg-card px-4 text-sm text-muted-foreground md:flex">Search complaint ID, citizen, district</div>
          <div className="rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">● Live Monitoring</div>
        </div>
      </div>

      {analytics.breached > 0 && <Link to="/officer/ai-alerts" className="flex items-center justify-between rounded-xl bg-gradient-to-r from-destructive to-warning p-6 text-destructive-foreground shadow-elevated"><span className="text-lg font-bold">{analytics.breached} Complaints Breached 48-Hour SLA!</span><span className="text-sm">Immediate action required</span></Link>}
      {analytics.critical > 0 && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 font-semibold text-destructive">{analytics.critical} complaints are critical or high risk. Act before SLA breach.</div>}
      {analytics.approaching > 0 && <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 font-semibold text-warning-foreground">{analytics.approaching} complaints approaching the 24-hour mark. Send reminders.</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3"><div className="text-sm text-muted-foreground">{s.label}</div><div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.tone}`}><s.icon className="h-5 w-5" /></div></div>
            <div className="mt-2 text-4xl font-bold">{s.value}</div>
            <div className="mt-2 text-sm text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Complaints Trend (30 Days)">
          <ResponsiveContainer width="100%" height={290}><LineChart data={analytics.daily}><CartesianGrid strokeDasharray="3 3" opacity={0.35} /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="filed" stroke="var(--primary)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="resolved" stroke="var(--success)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="breached" stroke="var(--destructive)" strokeWidth={2} strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer>
        </Panel>
        <Panel title="District-wise Distribution (Top 10)">
          <ResponsiveContainer width="100%" height={290}><BarChart data={analytics.byDistrict.slice(0, 10)} layout="vertical" margin={{ left: 24 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={92} /><Tooltip /><Legend /><Bar dataKey="resolved" fill="var(--success)" radius={[0, 4, 4, 0]} /><Bar dataKey="filed" fill="var(--warning)" radius={[0, 4, 4, 0]} /><Bar dataKey="breached" fill="var(--destructive)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Month-wise Filed vs Resolved"><ResponsiveContainer width="100%" height={250}><BarChart data={analytics.months}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="filed" fill="var(--primary)" radius={[4, 4, 0, 0]} /><Bar dataKey="resolved" fill="var(--success)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
        <Panel title="Severity Distribution"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={analytics.bySeverity} dataKey="value" nameKey="name" outerRadius={82} label>{analytics.bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></Panel>
        <Panel title="Water Body Risk Summary">
          <div className="space-y-4">
            {analytics.byDistrict.slice(0, 5).map((d) => <RiskRow key={d.name} label={d.name} value={d.risk} detail={`${d.filed} filed · ${d.breached} breached`} />)}
            {analytics.byDistrict.length === 0 && <div className="text-sm text-muted-foreground">No complaint data yet.</div>}
          </div>
        </Panel>
      </div>

      <Panel title="Recent Activity">
        <div className="space-y-2">
          {arr.slice(0, 8).map((c: any) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name} · {c.districts?.name}</span><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Stage: {c.current_rank}</span></div>
              <SlaCountdown deadline={c.sla_deadline} resolved={c.status === "resolved"} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border bg-card p-6 shadow-card"><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</div>;
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
