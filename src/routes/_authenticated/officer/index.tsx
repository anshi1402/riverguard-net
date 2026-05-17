import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, RANK_LABEL } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { format, subDays, startOfDay, startOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/officer/")({ component: Page });

const COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const SENIOR = new Set(["tahsildar", "rdo", "collector"]);

function Page() {
  const { profile } = useAuth();
  const rank = profile?.officer_rank ?? null;
  const isSenior = rank ? SENIOR.has(rank) : false;
  const isCollector = rank === "collector";
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["officer-home", profile?.district_id, rank],
    enabled: !!rank,
    queryFn: async () => {
      let q = supabase.from("complaints").select("*, water_bodies(name), districts(name)");
      if (!isCollector && profile?.district_id) q = q.eq("district_id", profile.district_id);
      if (rank === "wrd") q = q.in("type", ["water_flow_obstruction", "supply_channel", "surplus_channel"]);
      else if (!isSenior && rank !== "collector") q = q.eq("current_rank", rank as string);
      else if (rank === "tahsildar" || rank === "rdo") {
        // Senior ranks see their stage + everything escalated below or visible in district
      }
      const r = await q.order("created_at", { ascending: false });
      if (r.error) throw r.error; return r.data;
    },
  });

  useEffect(() => {
    const ch = supabase.channel("officer-home").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["officer-home"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const arr = data ?? [];
  const now = Date.now();

  const stats = useMemo(() => {
    const resolved = arr.filter((c: any) => c.status === "resolved").length;
    const breached = arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now).length;
    const compliance = arr.length === 0 ? 100 : Math.round(((arr.length - breached) / arr.length) * 100);
    return {
      Total: arr.length,
      Active: arr.length - resolved,
      Resolved: resolved,
      Overdue: breached,
      Compliance: `${compliance}%`,
    };
  }, [arr, now]);

  const dayWise = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) days[format(subDays(new Date(), i), "MMM dd")] = 0;
    arr.forEach((c: any) => {
      const d = startOfDay(new Date(c.created_at));
      const key = format(d, "MMM dd");
      if (key in days) days[key]++;
    });
    return Object.entries(days).map(([day, count]) => ({ day, count }));
  }, [arr]);

  const monthWise = useMemo(() => {
    const months: Record<string, { filed: number; resolved: number }> = {};
    for (let i = 5; i >= 0; i--) months[format(subMonths(new Date(), i), "MMM yy")] = { filed: 0, resolved: 0 };
    arr.forEach((c: any) => {
      const k = format(startOfMonth(new Date(c.created_at)), "MMM yy");
      if (months[k]) months[k].filed++;
      if (c.resolved_at) {
        const r = format(startOfMonth(new Date(c.resolved_at)), "MMM yy");
        if (months[r]) months[r].resolved++;
      }
    });
    return Object.entries(months).map(([m, v]) => ({ month: m, ...v }));
  }, [arr]);

  const bySeverity = useMemo(() => {
    const s: Record<string, number> = {};
    arr.forEach((c: any) => { s[c.severity] = (s[c.severity] ?? 0) + 1; });
    return Object.entries(s).map(([name, value]) => ({ name, value }));
  }, [arr]);

  const byType = useMemo(() => {
    const t: Record<string, number> = {};
    arr.forEach((c: any) => { t[c.type] = (t[c.type] ?? 0) + 1; });
    return Object.entries(t).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [arr]);

  const byDistrictRisk = useMemo(() => {
    const d: Record<string, { name: string; total: number; breached: number; critical: number }> = {};
    arr.forEach((c: any) => {
      const n = c.districts?.name ?? "Unknown";
      const e = (d[n] ??= { name: n, total: 0, breached: 0, critical: 0 });
      e.total++;
      if (c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now) e.breached++;
      if (c.severity === "critical" || c.severity === "high") e.critical++;
    });
    return Object.values(d)
      .map((d) => ({ ...d, risk: d.total === 0 ? 0 : Math.round(((d.breached * 2 + d.critical) / (d.total * 3)) * 100) }))
      .sort((a, b) => b.risk - a.risk);
  }, [arr, now]);

  // Simple compact view for VAO / WRD
  if (!isSenior) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Authority Dashboard</h1>
          <p className="text-sm text-muted-foreground">{rank ? RANK_LABEL[rank] : ""} — live queue scoped to your responsibility.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Object.entries(stats).slice(0, 4).map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="text-sm text-muted-foreground">{l}</div>
              <div className="mt-2 text-3xl font-bold">{v}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between"><div className="font-semibold">Most Urgent</div><Link to="/officer/queue" className="text-xs text-primary hover:underline">Open queue</Link></div>
          <div className="space-y-2">
            {arr.filter((c: any) => c.status !== "resolved").sort((a: any, b: any) => new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()).slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name}</span></div>
                <SlaCountdown deadline={c.sla_deadline} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Senior rank — full analytics dashboard
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{rank ? RANK_LABEL[rank] : "Authority"} Dashboard</h1>
          <p className="text-sm text-muted-foreground">{isCollector ? "Statewide overview" : `District-level overview · ${profile?.district_id ? "your jurisdiction" : ""}`}</p>
        </div>
        {Number(stats.Overdue) > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive">⚠ {stats.Overdue} SLA breach{Number(stats.Overdue) > 1 ? "es" : ""}</div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(stats).map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">{l}</div>
            <div className="mt-2 text-3xl font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">Daily Complaints (last 14 days)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dayWise}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">Month-wise Filed vs Resolved</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthWise}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip /><Legend />
              <Bar dataKey="filed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">Severity Mix</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={bySeverity} dataKey="value" nameKey="name" outerRadius={75} label>
                {bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">Complaint Types</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">District Risk Ranking</div>
          <div className="space-y-2">
            {byDistrictRisk.slice(0, 6).map((d) => (
              <div key={d.name} className="rounded-lg bg-muted/40 p-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{d.name}</span>
                  <span className={d.risk >= 60 ? "text-destructive" : d.risk >= 30 ? "text-amber-500" : "text-emerald-500"}>{d.risk}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                  <div className={"h-full " + (d.risk >= 60 ? "bg-destructive" : d.risk >= 30 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${d.risk}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{d.total} total · {d.breached} overdue · {d.critical} high/critical</div>
              </div>
            ))}
            {byDistrictRisk.length === 0 && <div className="text-sm text-muted-foreground">No data yet.</div>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="mb-3 flex items-center justify-between"><div className="font-semibold">Recent Activity</div><Link to="/officer/queue" className="text-xs text-primary hover:underline">Open queue</Link></div>
        <div className="space-y-2">
          {arr.slice(0, 8).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name} · {c.districts?.name}</span></div>
              <SlaCountdown deadline={c.sla_deadline} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
