import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MapPin, Image as ImageIcon, Loader2, ArrowUpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, RANK_LABEL } from "@/lib/auth";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GeoCamera } from "@/components/complaints/GeoCamera";
import { GeoUploader } from "@/components/complaints/GeoUploader";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/officer/queue")({ component: Page });

function Page() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const rank = profile?.officer_rank ?? null;
  const { data } = useQuery({
    queryKey: ["officer-queue", profile?.district_id, rank],
    enabled: !!profile?.district_id && !!rank,
    queryFn: async () => {
      let q = supabase.from("complaints").select("*, water_bodies(name,type), districts(name)").eq("district_id", profile!.district_id!);
      // WRD sees all technical water cases; Collector sees all; others see only their stage
      if (rank === "wrd") {
        q = q.in("type", ["water_flow_obstruction", "supply_channel", "surplus_channel"]);
      } else if (rank !== "collector") {
        q = q.eq("current_rank", rank as string);
      }
      const r = await q.order("sla_deadline");
      if (r.error) throw r.error; return r.data;
    },
  });

  useEffect(() => {
    if (!profile?.district_id) return;
    const ch = supabase.channel("officer-queue").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["officer-queue"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.district_id, qc]);

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const r = await supabase.from("complaints").update({ ...patch, assigned_officer_id: patch.assigned_officer_id ?? user?.id }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["officer-queue"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const escalate = useMutation({
    mutationFn: async (c: any) => {
      const next = c.current_rank === "vao" ? "tahsildar" : c.current_rank === "tahsildar" ? "rdo" : "collector";
      const r = await supabase.from("complaints").update({
        current_rank: next,
        escalation_level: (c.escalation_level ?? 0) + 1,
        last_escalated_at: new Date().toISOString(),
        sla_deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      }).eq("id", c.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Escalated to next authority"); qc.invalidateQueries({ queryKey: ["officer-queue"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assigned Complaints</h1>
        <p className="text-sm text-muted-foreground">{rank ? RANK_LABEL[rank] : "Authority"} · {profile?.district_id ? "your district" : ""} — sorted by SLA deadline.</p>
      </div>
      {data?.length === 0 && <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">Queue is clear. Great work.</div>}
      <div className="space-y-3">
        {data?.map((c: any) => (
          <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{c.code}</span>
                  <StatusBadge status={c.status} />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">{c.severity}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Stage: {c.current_rank}</span>
                  <SlaCountdown deadline={c.sla_deadline} resolved={c.status === "resolved"} />
                </div>
                <div className="mt-1 text-base font-semibold">{c.water_bodies?.name} · {c.districts?.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{String(c.type).replace(/_/g, " ")} · filed {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                <p className="mt-2 text-sm">{c.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {c.lat && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span>}
                  {c.image_url && <a href={c.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ImageIcon className="h-3 w-3" /> View photo</a>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {c.status === "submitted" && <Button size="sm" onClick={() => update.mutate({ id: c.id, patch: { status: "assigned" } })}>Acknowledge</Button>}
                {(c.status === "assigned" || c.status === "submitted") && <Button size="sm" variant="outline" onClick={() => update.mutate({ id: c.id, patch: { status: "in_progress" } })}>Mark In Progress</Button>}
                {(c.status === "in_progress" || c.status === "reinvestigate" || c.status === "assigned") && <ResolveDialog complaint={c} onDone={() => qc.invalidateQueries({ queryKey: ["officer-queue"] })} />}
                {c.status !== "resolved" && c.current_rank !== "collector" && rank !== "wrd" && (
                  <Button size="sm" variant="ghost" onClick={() => escalate.mutate(c)}><ArrowUpCircle className="mr-1 h-3.5 w-3.5" /> Escalate</Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResolveDialog({ complaint, onDone }: { complaint: any; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!notes.trim()) return toast.error("Add resolution notes");
    setBusy(true);
    try {
      let url: string | null = null;
      if (file && user) {
        const path = `${user.id}/resolve-${complaint.id}-${Date.now()}.jpg`;
        const up = await supabase.storage.from("complaint-photos").upload(path, file);
        if (up.error) throw up.error;
        url = supabase.storage.from("complaint-photos").getPublicUrl(path).data.publicUrl;
      }
      const r = await supabase.from("complaints").update({ status: "resolved" as any, resolution_notes: notes, resolution_photo_url: url, assigned_officer_id: user?.id, resolved_at: new Date().toISOString() }).eq("id", complaint.id);
      if (r.error) throw r.error;
      toast.success("Resolution submitted");
      setOpen(false); setNotes(""); setFile(null); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">Submit Resolution</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Resolution Report — {complaint.code}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Textarea rows={4} placeholder="Describe the action taken…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <GeoUploader onPicked={(f) => setFile(f)} />
            <GeoCamera onCapture={(f) => setFile(f)} />
          </div>
          {file && <p className="text-xs text-success">Photo attached: {file.name}</p>}
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Report"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
