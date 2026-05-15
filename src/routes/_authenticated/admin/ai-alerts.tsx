import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Brain, MapPin, TrendingUp, Activity, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { haversineKm } from "@/lib/geo";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/ai-alerts")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ai-alerts-admin"],
    queryFn: async () => {
      const r = await supabase.from("complaints").select("*, water_bodies(name,type), districts(name)").order("created_at", { ascending: false });
      if (r.error) throw r.error; return r.data;
    },
  });

  useEffect(() => {
    const ch = supabase.channel("ai-alerts").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["ai-alerts-admin"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const alerts = useMemo(() => analyse(data ?? []), [data]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-hero p-6 text-navy-foreground shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/20"><Brain className="h-6 w-6 text-brand" /></div>
          <div>
            <h1 className="text-2xl font-bold">AI Alerts — State Overview</h1>
            <p className="text-sm text-navy-foreground/75">Pattern detection across all districts. Updates live.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { l: "Critical Alerts", v: alerts.filter(a => a.severity === "critical").length, i: AlertTriangle },
            { l: "Hotspots Detected", v: alerts.filter(a => a.kind === "hotspot").length, i: MapPin },
            { l: "SLA Breaches",    v: alerts.filter(a => a.kind === "sla").length,     i: Activity },
            { l: "Repeat Offenders",v: alerts.filter(a => a.kind === "repeat").length,  i: TrendingUp },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-brand/20 bg-navy/40 p-4">
              <div className="flex items-center justify-between text-brand"><s.i className="h-4 w-4" /><span className="text-2xl font-bold">{s.v}</span></div>
              <div className="mt-1 text-xs uppercase tracking-wide text-navy-foreground/60">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">No anomalies detected. System nominal.</div>}
        {alerts.map((a) => (
          <div key={a.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.severity === "critical" ? "bg-destructive/15 text-destructive" : a.severity === "high" ? "bg-warning/20 text-warning-foreground" : "bg-primary/10 text-primary"}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{a.kind}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${a.severity === "critical" ? "bg-destructive/15 text-destructive" : a.severity === "high" ? "bg-warning/20 text-warning-foreground" : "bg-primary/10 text-primary"}`}>{a.severity}</span>
                </div>
                <div className="mt-1 text-base font-semibold">{a.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                {a.refs && <div className="mt-2 flex flex-wrap gap-1.5">{a.refs.map((r) => <span key={r} className="font-mono text-[11px] rounded bg-muted px-1.5 py-0.5">{r}</span>)}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        <div className="space-y-2">
          {(data ?? []).slice(0, 10).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm shadow-card">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs font-bold text-primary">{c.code}</span>
                <StatusBadge status={c.status} />
                <span className="truncate">{c.water_bodies?.name} · {c.districts?.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Alert { id: string; kind: "hotspot" | "sla" | "repeat" | "spike"; severity: "low" | "high" | "critical"; title: string; body: string; refs?: string[] }

function analyse(rows: any[]): Alert[] {
  const out: Alert[] = [];
  const now = Date.now();

  // SLA breaches
  const breached = rows.filter((c) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now);
  for (const c of breached) {
    out.push({ id: `sla-${c.id}`, kind: "sla", severity: "critical", title: `SLA breached — ${c.code}`, body: `${c.water_bodies?.name} (${c.districts?.name}) is past its 48h deadline. Officer action required immediately.`, refs: [c.code] });
  }

  // Hotspot clustering — water bodies with 2+ open complaints
  const byBody = new Map<string, any[]>();
  for (const c of rows) {
    if (c.status === "resolved") continue;
    const k = c.water_body_id;
    byBody.set(k, [...(byBody.get(k) ?? []), c]);
  }
  for (const [, group] of byBody) {
    if (group.length >= 2) {
      out.push({ id: `hot-${group[0].water_body_id}`, kind: "hotspot", severity: group.length >= 4 ? "critical" : "high",
        title: `Hotspot at ${group[0].water_bodies?.name}`,
        body: `${group.length} active complaints clustered at this water body in ${group[0].districts?.name}. Recommend deploying additional field officers.`,
        refs: group.map((g) => g.code) });
    }
  }

  // Repeat type within district
  const byTypeDistrict = new Map<string, any[]>();
  for (const c of rows) {
    const k = `${c.district_id}|${c.type}`;
    byTypeDistrict.set(k, [...(byTypeDistrict.get(k) ?? []), c]);
  }
  for (const [, group] of byTypeDistrict) {
    if (group.length >= 3) {
      out.push({ id: `rep-${group[0].district_id}-${group[0].type}`, kind: "repeat", severity: "high",
        title: `Recurring ${String(group[0].type).replace(/_/g, " ")} in ${group[0].districts?.name}`,
        body: `${group.length} reports of the same complaint type — investigate underlying cause and run a district-wide audit.`,
        refs: group.slice(0, 5).map((g) => g.code) });
    }
  }

  // Geo proximity clusters — complaints within 1km in same district
  const withGeo = rows.filter((c) => c.lat && c.lng);
  const seen = new Set<string>();
  for (const a of withGeo) {
    if (seen.has(a.id)) continue;
    const cluster = withGeo.filter((b) => b.district_id === a.district_id && haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) < 1);
    if (cluster.length >= 3) {
      cluster.forEach((c) => seen.add(c.id));
      out.push({ id: `geo-${a.id}`, kind: "spike", severity: "high",
        title: `Geo cluster near ${a.water_bodies?.name}`,
        body: `${cluster.length} complaints filed within 1km radius. Possible coordinated incident or contamination plume.`,
        refs: cluster.slice(0, 5).map((g) => g.code) });
    }
  }

  return out.sort((x, y) => (y.severity === "critical" ? 1 : 0) - (x.severity === "critical" ? 1 : 0));
}