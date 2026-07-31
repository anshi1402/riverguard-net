import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const ACTION_LABEL: Record<string, string> = {
  submitted: "Complaint Submitted",
  status_changed: "Status Updated",
  escalated: "Escalated",
  resolved: "Resolved",
};

export function ComplaintTimeline({ complaintId }: { complaintId: string }) {
  const { data } = useQuery({
    queryKey: ["complaint-timeline", complaintId],
    queryFn: async () => {
      const r = await supabase
        .from("complaint_events")
        .select("id,action,notes,created_at,actor_id")
        .eq("complaint_id", complaintId)
        .order("created_at");
      if (r.error) throw r.error;
      const ids = Array.from(new Set((r.data ?? []).map((e) => e.actor_id).filter(Boolean))) as string[];
      let names: Record<string, string> = {};
      if (ids.length) {
        const p = await supabase.from("profiles").select("id,full_name,officer_rank").in("id", ids);
        names = Object.fromEntries((p.data ?? []).map((x: any) => [x.id, x.officer_rank ? `${x.full_name} (${String(x.officer_rank).toUpperCase()})` : x.full_name]));
      }
      return (r.data ?? []).map((e: any) => ({ ...e, actor: e.actor_id ? names[e.actor_id] ?? "Officer" : "System" }));
    },
  });

  if (!data?.length) return <div className="text-xs text-muted-foreground">Timeline will appear as officers act on this complaint.</div>;

  return (
    <ol className="relative space-y-4 border-l border-border pl-4">
      {data.map((e: any) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="text-sm font-medium">{ACTION_LABEL[e.action] ?? e.action}</div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(e.created_at), "dd MMM yyyy · HH:mm")} · {e.actor}
          </div>
          {e.notes && <div className="mt-0.5 text-xs">{e.notes}</div>}
        </li>
      ))}
    </ol>
  );
}
