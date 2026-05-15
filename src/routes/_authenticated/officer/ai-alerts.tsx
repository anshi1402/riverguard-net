import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Brain, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { haversineKm } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/officer/ai-alerts")({ component: Page });

function Page() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["ai-alerts-officer", profile?.district_id],
    enabled: !!profile?.district_id,
    queryFn: async () => {
      const r = await supabase.from("complaints").select("*, water_bodies(name)").eq("district_id", profile!.district_id!);
      if (r.error) throw r.error; return r.data;
    },
  });

  useEffect(() => {
    if (!profile?.district_id) return;
    const ch = supabase.channel("ai-officer").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["ai-alerts-officer"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.district_id, qc]);

  const now = Date.now();
  const open = (data ?? []).filter((c: any) => c.status !== "resolved");
  const overdue = open.filter((c: any) => new Date(c.sla_deadline).getTime() < now);
  const dueSoon = open.filter((c: any) => { const d = new Date(c.sla_deadline).getTime() - now; return d > 0 && d < 6 * 3600000; });

  // Hotspots in district
  const byBody = new Map<string, any[]>();
  open.forEach((c: any) => byBody.set(c.water_body_id, [...(byBody.get(c.water_body_id) ?? []), c]));
  const hotspots = [...byBody.values()].filter((g) => g.length >= 2);

  // Geo proximity
  const withGeo = open.filter((c: any) => c.lat);
  const seen = new Set<string>();
  const clusters: any[][] = [];
  for (const a of withGeo) {
    if (seen.has(a.id)) continue;
    const cl = withGeo.filter((b: any) => haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) < 1);
    if (cl.length >= 2) { cl.forEach((c: any) => seen.add(c.id)); clusters.push(cl); }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-hero p-6 text-navy-foreground shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/20"><Brain className="h-6 w-6 text-brand" /></div>
          <div><h1 className="text-2xl font-bold">AI Alerts — Your District</h1><p className="text-sm text-navy-foreground/75">Smart prioritization for your active queue.</p></div>
        </div>
      </div>

      <Section title="Overdue (SLA Breached)" icon={AlertTriangle} tone="destructive">
        {overdue.length === 0 ? <Empty msg="None — keep it that way." /> : overdue.map((c: any) => <Row key={c.id} c={c} />)}
      </Section>

      <Section title="Due Soon (<6h)" icon={Clock} tone="warning">
        {dueSoon.length === 0 ? <Empty msg="No urgent deadlines." /> : dueSoon.map((c: any) => <Row key={c.id} c={c} />)}
      </Section>

      <Section title="Hotspot Water Bodies" icon={MapPin} tone="primary">
        {hotspots.length === 0 ? <Empty msg="No hotspots detected." /> : hotspots.map((g, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-card">
            <div className="font-semibold">{g[0].water_bodies?.name}</div>
            <div className="text-xs text-muted-foreground">{g.length} active complaints — investigate root cause.</div>
            <div className="mt-2 flex flex-wrap gap-1">{g.map((c) => <span key={c.id} className="font-mono text-[11px] rounded bg-muted px-1.5 py-0.5">{c.code}</span>)}</div>
          </div>
        ))}
      </Section>

      {clusters.length > 0 && (
        <Section title="Geo Clusters (within 1 km)" icon={MapPin} tone="warning">
          {clusters.map((g, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-card">
              <div className="font-semibold">{g.length} complaints clustered geographically</div>
              <div className="mt-2 flex flex-wrap gap-1">{g.map((c) => <span key={c.id} className="font-mono text-[11px] rounded bg-muted px-1.5 py-0.5">{c.code}</span>)}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, tone, children }: any) {
  const tones: Record<string, string> = { destructive: "text-destructive", warning: "text-warning-foreground", primary: "text-primary" };
  return (
    <div>
      <div className={`mb-3 flex items-center gap-2 font-semibold ${tones[tone]}`}><Icon className="h-4 w-4" /> {title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ c }: { c: any }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm shadow-card">
      <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name}</span></div>
      <SlaCountdown deadline={c.sla_deadline} />
    </div>
  );
}
function Empty({ msg }: { msg: string }) { return <div className="rounded-xl border bg-card p-4 text-center text-sm text-muted-foreground shadow-card">{msg}</div>; }