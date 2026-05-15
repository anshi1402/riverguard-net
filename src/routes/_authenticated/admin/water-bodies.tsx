import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/water-bodies")({ component: Page });

function Page() {
  const { data } = useQuery({
    queryKey: ["water-bodies-admin"],
    queryFn: async () => {
      const wb = await supabase.from("water_bodies").select("id, name, type, districts(name)").order("name");
      const c = await supabase.from("complaints").select("water_body_id, status");
      return (wb.data ?? []).map((w: any) => {
        const my = (c.data ?? []).filter((x: any) => x.water_body_id === w.id);
        return { ...w, total: my.length, open: my.filter((x: any) => x.status !== "resolved").length };
      });
    },
  });
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Water Bodies</h1><p className="text-sm text-muted-foreground">{data?.length ?? 0} water bodies across districts.</p></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((w: any) => (
          <div key={w.id} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div><div className="flex items-center gap-2 font-semibold"><Droplets className="h-4 w-4 text-brand" /> {w.name}</div><div className="text-xs capitalize text-muted-foreground">{w.type} · {w.districts?.name}</div></div>
              {w.open > 0 && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">{w.open} open</span>}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">{w.total} total complaints</div>
          </div>
        ))}
      </div>
    </div>
  );
}
