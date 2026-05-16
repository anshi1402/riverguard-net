import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, Satellite, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/officer/ai-alerts")({ component: Page });

function Page() {
  const { profile } = useAuth();
  return <AlertsView districtId={profile?.district_id ?? undefined} title="AI Alerts — Your District" />;
}

export function AlertsView({ districtId, title }: { districtId?: string; title: string }) {
  const [tab, setTab] = useState<"fencing"|"satellite"|"overdue">("fencing");
  const { data: alerts } = useQuery({
    queryKey: ["ai_alerts", districtId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("ai_alerts").select("*, water_bodies(name), districts(name)").order("detected_at", { ascending: false });
      if (districtId) q = q.eq("district_id", districtId);
      return (await q).data ?? [];
    },
  });
  const { data: overdue } = useQuery({
    queryKey: ["ai_overdue", districtId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("complaints").select("id,code,status,sla_deadline,current_rank,water_bodies(name),districts(name)")
        .lt("sla_deadline", new Date().toISOString()).neq("status", "resolved");
      if (districtId) q = q.eq("district_id", districtId);
      return (await q).data ?? [];
    },
  });

  const fencing = (alerts ?? []).filter((a: any) => a.source === "fencing");
  const satellite = (alerts ?? []).filter((a: any) => a.source === "satellite");
  const tabs = [
    { id: "fencing" as const,   label: "Fencing Alerts",   icon: AlertTriangle, count: fencing.length },
    { id: "satellite" as const, label: "Satellite Alerts", icon: Satellite,     count: satellite.length },
    { id: "overdue" as const,   label: "Overdue (SLA Breach)", icon: Clock,    count: overdue?.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-hero p-6 text-navy-foreground shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/20"><Brain className="h-6 w-6 text-brand" /></div>
          <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-navy-foreground/75">Geo-fence breaches, satellite anomalies, and SLA escalations.</p></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition", tab === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>
            <t.icon className="h-4 w-4" /> {t.label} <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{t.count}</span>
          </button>
        ))}
      </div>
      {tab === "fencing"   && <List items={fencing}   empty="No geo-fence breaches detected." />}
      {tab === "satellite" && <List items={satellite} empty="No satellite anomalies detected." />}
      {tab === "overdue"   && (
        <div className="space-y-2">
          {(overdue ?? []).length === 0 && <Empty msg="No SLA breaches — all stages on track." />}
          {(overdue ?? []).map((c: any) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{c.code}</span>
                <StatusBadge status={c.status} />
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Stage: {c.current_rank}</span>
                <span className="text-sm">{c.water_bodies?.name} · {c.districts?.name}</span>
              </div>
              <SlaCountdown deadline={c.sla_deadline} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function List({ items, empty }: { items: any[]; empty: string }) {
  if (items.length === 0) return <Empty msg={empty} />;
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.id} className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              a.severity === "critical" ? "bg-destructive/15 text-destructive" : a.severity === "high" ? "bg-warning/20 text-warning-foreground" : "bg-primary/10 text-primary")}>{a.severity}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{a.source}</span>
            {a.confidence && <span className="text-[11px] text-muted-foreground">confidence {Math.round(a.confidence * 100)}%</span>}
          </div>
          <div className="mt-2 text-base font-semibold">{a.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
          <div className="mt-2 text-xs text-muted-foreground">{a.water_bodies?.name} · {a.districts?.name} · {new Date(a.detected_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
function Empty({ msg }: { msg: string }) { return <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">{msg}</div>; }
