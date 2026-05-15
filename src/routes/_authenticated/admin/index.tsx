import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Page });

const COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

function Page() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["admin-rows"],
    queryFn: async () => (await supabase.from("complaints").select("*, water_bodies(name), districts(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: meta } = useQuery({
    queryKey: ["admin-meta"],
    queryFn: async () => {
      const [w, d] = await Promise.all([
        supabase.from("water_bodies").select("id", { count: "exact", head: true }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
      ]);
      return { wb: w.count ?? 0, ds: d.count ?? 0 };
    },
  });
  useEffect(() => {
    const ch = supabase.channel("admin-rt").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["admin-rows"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const stats = useMemo(() => {
    const r = rows ?? [];
    const now = Date.now();
    const resolved = r.filter((c: any) => c.status === "resolved").length;
    const breached = r.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now).length;
    const compliance = r.length === 0 ? 100 : Math.round(((r.length - breached) / r.length) * 100);
    const byDistrict = Object.values(r.reduce((acc: any, c: any) => { const k = c.districts?.name ?? "Unknown"; (acc[k] ??= { name: k, value: 0 }).value++; return acc; }, {})) as any[];
    const bySev = Object.values(r.reduce((acc: any, c: any) => { (acc[c.severity] ??= { name: c.severity, value: 0 }).value++; return acc; }, {})) as any[];
    return { total: r.length, resolved, breached, active: r.length - resolved, compliance, byDistrict, bySev };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Admin Dashboard</h1><p className="text-sm text-muted-foreground">Statewide overview · BlueGeo AI</p></div>
        {stats.breached > 0 && <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive">⚠ {stats.breached} SLA breach{stats.breached > 1 ? "es" : ""}</div>}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Total Complaints", v: stats.total },
          { l: "Active",           v: stats.active },
          { l: "Resolved",         v: stats.resolved },
          { l: "SLA Compliance",   v: `${stats.compliance}%` },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">Complaints by District</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.byDistrict}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-3 font-semibold">Severity Mix</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart><Pie data={stats.bySev} dataKey="value" nameKey="name" outerRadius={90} label>{stats.bySev.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between"><div className="font-semibold">Recent Activity</div><div className="text-xs text-muted-foreground">{meta?.wb ?? 0} water bodies · {meta?.ds ?? 0} districts</div></div>
        <div className="space-y-2">
          {(rows ?? []).slice(0, 8).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name} · {c.districts?.name}</span></div>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
