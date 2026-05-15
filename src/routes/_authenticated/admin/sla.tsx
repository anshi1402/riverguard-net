import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sla")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["sla-monitor"],
    queryFn: async () => (await supabase.from("complaints").select("*, water_bodies(name), districts(name)").neq("status", "resolved")).data ?? [],
  });
  useEffect(() => {
    const ch = supabase.channel("sla-rt").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["sla-monitor"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const now = Date.now();
  const breached = (data ?? []).filter((c: any) => new Date(c.sla_deadline).getTime() < now);
  const dueSoon = (data ?? []).filter((c: any) => { const d = new Date(c.sla_deadline).getTime() - now; return d > 0 && d < 6 * 3600000; });
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">SLA Monitoring & Escalation</h1><p className="text-sm text-muted-foreground">All open complaints with SLA status.</p></div>
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Breached ({breached.length})</div>
        {breached.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : breached.map((c: any) => <Row key={c.id} c={c} />)}
      </div>
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
        <div className="mb-3 font-semibold text-warning-foreground">Due within 6h ({dueSoon.length})</div>
        {dueSoon.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : dueSoon.map((c: any) => <Row key={c.id} c={c} />)}
      </div>
    </div>
  );
}
function Row({ c }: { c: any }) {
  return <div className="mb-2 flex items-center justify-between rounded-xl bg-card p-3 text-sm shadow-card"><div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name} · {c.districts?.name}</span></div><SlaCountdown deadline={c.sla_deadline} /></div>;
}
