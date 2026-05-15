import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";

export const Route = createFileRoute("/_authenticated/officer/")({ component: Page });

function Page() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["officer-home", profile?.district_id],
    enabled: !!profile?.district_id,
    queryFn: async () => {
      const r = await supabase.from("complaints").select("*, water_bodies(name)").eq("district_id", profile!.district_id!);
      if (r.error) throw r.error; return r.data;
    },
  });
  useEffect(() => {
    if (!profile?.district_id) return;
    const ch = supabase.channel("officer-home").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["officer-home"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.district_id, qc]);

  const now = Date.now();
  const arr = data ?? [];
  const stats = {
    Assigned: arr.filter((c: any) => ["submitted","assigned"].includes(c.status)).length,
    "In Progress": arr.filter((c: any) => c.status === "in_progress").length,
    "Resolved Today": arr.filter((c: any) => c.status === "resolved" && c.resolved_at && new Date(c.resolved_at).toDateString() === new Date().toDateString()).length,
    Overdue: arr.filter((c: any) => c.status !== "resolved" && new Date(c.sla_deadline).getTime() < now).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Officer Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live queue for your district.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(stats).map(([l, v]) => (
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
