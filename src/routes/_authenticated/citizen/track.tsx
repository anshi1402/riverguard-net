import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MapPin, Repeat, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/citizen/track")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-complaints", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const r = await supabase.from("complaints").select("*, water_bodies(name,type), districts(name)").eq("citizen_id", user!.id).order("created_at", { ascending: false });
      if (r.error) throw r.error; return r.data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("citizen-complaints").on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `citizen_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["my-complaints"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const reinvestigate = useMutation({
    mutationFn: async (id: string) => {
      const reason = window.prompt("Why do you want this re-investigated?");
      if (!reason) throw new Error("Cancelled");
      const r = await supabase.from("complaints").update({ status: "reinvestigate" as any, reinvestigation_reason: reason, reinvestigation_count: 1 }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Re-investigation requested"); qc.invalidateQueries({ queryKey: ["my-complaints"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Complaints</h1>
        <p className="text-sm text-muted-foreground">Live status — updates from officers and admins reflect here automatically.</p>
      </div>
      {data?.length === 0 && <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">No complaints yet. File your first one.</div>}
      <div className="space-y-3">
        {data?.map((c: any) => (
          <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{c.code}</span>
                  <StatusBadge status={c.status} />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.severity}</span>
                </div>
                <div className="mt-1 text-base font-semibold">{c.water_bodies?.name} · {c.districts?.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{String(c.type).replace(/_/g, " ")} · filed {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                <p className="mt-2 line-clamp-2 text-sm">{c.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {c.lat && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>}
                  <SlaCountdown deadline={c.sla_deadline} resolved={c.status === "resolved"} />
                </div>
                {c.resolution_notes && (
                  <div className="mt-3 rounded-md border border-success/30 bg-success/5 p-2 text-xs">
                    <div className="font-semibold text-success">Officer report</div>
                    <div>{c.resolution_notes}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {c.image_url && <a href={c.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ImageIcon className="h-3 w-3" /> Photo</a>}
                {c.status === "resolved" && c.reinvestigation_count === 0 && (
                  <Button size="sm" variant="outline" onClick={() => reinvestigate.mutate(c.id)}><Repeat className="mr-1 h-3.5 w-3.5" /> Re-investigate</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
