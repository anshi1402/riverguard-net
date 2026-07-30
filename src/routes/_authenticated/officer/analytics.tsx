import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { format, startOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/officer/analytics")({ component: Page });

const COLORS = ["var(--primary)", "var(--brand)", "var(--success)", "var(--warning)", "var(--destructive)"];

function Page() {
  const { profile } = useAuth();
  const { data } = useQuery({
    queryKey: ["collector-analytics"],
    queryFn: async () => {
      const r = await supabase.from("complaints").select("*, water_bodies(name,type), districts(name)").order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const arr = data ?? [];
  const now = Date.now();

  const a = useMemo(() => {
    const resolved = arr.filter((c: any) => c.status === "resolved").length;
    const breached = arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now).length;
    const escalated = arr.filter((c: any) => (c.escalation_level ?? 0) > 0).length;
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
    const byStage = Object.values(arr.reduce((acc: any, c: any) => { (acc[c.current_rank] ??= { name: c.current_rank, value: 0 }).value++; return acc; }, {})) as any[];
    const byType = Object.values(arr.reduce((acc: any, c: any) => { const name = String(c.type).replace(/_/g, " "); (acc[name] ??= { name, value: 0 }).value++; return acc; }, {})) as any[];
    return {
      resolved, breached, escalated, active: arr.length - resolved,
      months: Object.entries(months).map(([month, v]) => ({ month, ...v })),
      byStage, byType,
    };
  }, [arr, now]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Complaint Analytics</h1>
        <p className="text-sm text-muted-foreground">District Collector — {profile?.district_id ? "full district oversight" : "oversight"} of every complaint stage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { l: "Total Complaints", v: arr.length },
          { l: "Active", v: a.active },
          { l: "Resolved", v: a.resolved },
          { l: "Escalated", v: a.escalated },
          { l: "SLA Breached", v: a.breached },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold">Month-wise Complaints</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={a.months}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="filed" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold">Complaints by Stage</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={a.byStage} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2}>
                {a.byStage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold">All Complaints</h2>
        <div className="space-y-2">
          {arr.map((c: any) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-primary">{c.code}</span>
                <StatusBadge status={c.status} />
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Stage: {c.current_rank}</span>
                <span>{c.water_bodies?.name} · {c.districts?.name}</span>
              </div>
              <SlaCountdown deadline={c.sla_deadline} resolved={c.status === "resolved"} />
            </div>
          ))}
          {arr.length === 0 && <div className="text-sm text-muted-foreground">No complaints yet.</div>}
        </div>
      </div>
    </div>
  );
}
