import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/complaints")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const { data } = useQuery({
    queryKey: ["admin-complaints"],
    queryFn: async () => (await supabase.from("complaints").select("*, water_bodies(name), districts(name)").order("created_at", { ascending: false })).data ?? [],
  });
  useEffect(() => {
    const ch = supabase.channel("admin-complaints-rt").on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => qc.invalidateQueries({ queryKey: ["admin-complaints"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = (data ?? []).filter((c: any) => {
    if (status !== "all" && c.status !== status) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    return c.code.toLowerCase().includes(t) || c.water_bodies?.name?.toLowerCase().includes(t) || c.districts?.name?.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">All Complaints</h1><p className="text-sm text-muted-foreground">{filtered.length} of {data?.length ?? 0}</p></div>
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search code, water body, district…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option><option value="assigned">Assigned</option><option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option><option value="reinvestigate">Re-investigate</option><option value="sla_breached">SLA Breached</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-3">Code</th><th className="p-3">Water Body</th><th className="p-3">District</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">SLA</th><th className="p-3">Filed</th></tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono text-xs font-bold text-primary">{c.code}</td>
                <td className="p-3">{c.water_bodies?.name}</td>
                <td className="p-3">{c.districts?.name}</td>
                <td className="p-3 capitalize">{String(c.type).replace(/_/g, " ")}</td>
                <td className="p-3"><StatusBadge status={c.status} /></td>
                <td className="p-3"><SlaCountdown deadline={c.sla_deadline} resolved={c.status === "resolved"} /></td>
                <td className="p-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
