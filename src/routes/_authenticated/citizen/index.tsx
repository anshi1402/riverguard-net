import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/citizen/")({ component: Page });

function Page() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["citizen-home", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const r = await supabase.from("complaints").select("id,code,status,created_at,water_bodies(name)").eq("citizen_id", user!.id).order("created_at", { ascending: false });
      if (r.error) throw r.error; return r.data;
    },
  });
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("c-home").on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `citizen_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["citizen-home"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);
  const counts = {
    Filed: data?.length ?? 0,
    "In Progress": data?.filter((c) => ["assigned","under_verification","in_progress","escalated","reinvestigate","reinvestigating"].includes(c.status as string)).length ?? 0,
    Resolved: data?.filter((c) => ["resolved","closed"].includes(c.status as string)).length ?? 0,
  };
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-citizen p-8 text-primary-foreground shadow-elevated">
        <div className="text-2xl font-bold">Hello, {profile?.full_name ?? "Citizen"}! 👋</div>
        <p className="mt-1 text-primary-foreground/80">Help us protect Tamil Nadu's water bodies</p>
        <Link to="/citizen/file"><Button size="lg" className="mt-5 bg-background text-primary hover:bg-background/90"><Plus className="mr-2 h-4 w-4" /> Report a Complaint</Button></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(counts).map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="text-3xl font-bold">{v}</div>
            <div className="mt-1 text-sm text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="mb-3 flex items-center justify-between"><div className="font-semibold">Recent Complaints</div><Link to="/citizen/track" className="text-xs text-primary hover:underline">View all</Link></div>
        {data?.length === 0 && <div className="text-sm text-muted-foreground">You haven't filed any complaints yet.</div>}
        <div className="space-y-2">
          {data?.slice(0, 5).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex items-center gap-3"><span className="font-mono text-xs font-bold text-primary">{c.code}</span><StatusBadge status={c.status} /><span>{c.water_bodies?.name}</span></div>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
