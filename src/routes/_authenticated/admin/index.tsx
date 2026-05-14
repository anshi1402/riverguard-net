import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Page });

function Page() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [c, w, d] = await Promise.all([
        supabase.from("complaints").select("status", { count: "exact" }),
        supabase.from("water_bodies").select("id", { count: "exact", head: true }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
      ]);
      return { total: c.count ?? 0, waterBodies: w.count ?? 0, districts: d.count ?? 0 };
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">BlueGeo AI — Water Body Protection System, Tamil Nadu</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Total Complaints", v: data?.total ?? 0 },
          { l: "Water Bodies",     v: data?.waterBodies ?? 0 },
          { l: "Districts Covered",v: data?.districts ?? 0 },
          { l: "SLA Compliance",   v: "—" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground shadow-card">Live charts (trend, district distribution, severity pie, SLA breach center) ship next.</div>
    </div>
  );
}
