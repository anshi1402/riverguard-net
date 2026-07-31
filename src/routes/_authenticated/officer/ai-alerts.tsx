import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { daysOverdue } from "@/lib/complaint-status";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/officer/ai-alerts")({ component: Page });

function Page() {
  const { profile } = useAuth();
  return <AlertsView districtId={profile?.district_id ?? undefined} title="AI Alerts — Your District" />;
}

export function AlertsView({ districtId, title }: { districtId?: string; title: string }) {
  const { data: overdue } = useQuery({
    queryKey: ["ai_overdue", districtId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("complaints").select("id,code,type,status,sla_deadline,current_rank,escalation_level,assigned_officer_id,water_bodies(name),districts(name)")
        .lt("sla_deadline", new Date().toISOString()).not("status", "in", "(resolved,rejected,closed)");
      if (districtId) q = q.eq("district_id", districtId);
      const rows = (await q).data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.assigned_officer_id).filter(Boolean))) as string[];
      let names: Record<string, string> = {};
      if (ids.length) {
        const p = await supabase.from("profiles").select("id,full_name").in("id", ids);
        names = Object.fromEntries((p.data ?? []).map((x: any) => [x.id, x.full_name]));
      }
      return rows.map((r: any) => ({ ...r, officer: r.assigned_officer_id ? names[r.assigned_officer_id] ?? "Unassigned" : "Unassigned" }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-hero p-6 text-navy-foreground shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/20"><Brain className="h-6 w-6 text-brand" /></div>
          <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-navy-foreground/75">Complaints that crossed the 48-hour SLA window and require escalation.</p></div>
        </div>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
        <Clock className="h-4 w-4" /> Overdue (SLA Breach)
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">{overdue?.length ?? 0}</span>
      </div>
      <div className="space-y-2">
          {(overdue ?? []).length === 0 && <Empty msg="No SLA breaches — all stages on track." />}
          {(overdue ?? []).map((c: any) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{c.code}</span>
                  <StatusBadge status={c.status} />
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Stage: {c.current_rank}</span>
                  <span className="text-sm font-medium capitalize">{String(c.type).replace(/_/g, " ")} · {c.water_bodies?.name} · {c.districts?.name}</span>
                </div>
                <SlaCountdown deadline={c.sla_deadline} />
              </div>
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div><span className="font-semibold text-foreground">Officer:</span> {c.officer}</div>
                <div><span className="font-semibold text-foreground">Due:</span> {format(new Date(c.sla_deadline), "dd MMM yyyy HH:mm")}</div>
                <div><span className="font-semibold text-destructive">{daysOverdue(c.sla_deadline)}</span> days overdue</div>
                <div><span className="font-semibold text-foreground">Escalation level:</span> {c.escalation_level ?? 0}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) { return <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">{msg}</div>; }
