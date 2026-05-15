import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/officers")({ component: Page });

function Page() {
  const { data } = useQuery({
    queryKey: ["officers"],
    queryFn: async () => {
      const roles = await supabase.from("user_roles").select("user_id").eq("role", "officer");
      const ids = (roles.data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const profs = await supabase.from("profiles").select("id, full_name, phone, on_duty, districts(name)").in("id", ids);
      const complaints = await supabase.from("complaints").select("assigned_officer_id, status, sla_deadline").in("assigned_officer_id", ids);
      return (profs.data ?? []).map((p: any) => {
        const my = (complaints.data ?? []).filter((c: any) => c.assigned_officer_id === p.id);
        return { ...p, open: my.filter((c: any) => c.status !== "resolved").length, resolved: my.filter((c: any) => c.status === "resolved").length };
      });
    },
  });
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Officer Tracking</h1><p className="text-sm text-muted-foreground">Caseload and on-duty status.</p></div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Officer</th><th className="p-3">District</th><th className="p-3">On Duty</th><th className="p-3">Open</th><th className="p-3">Resolved</th></tr></thead>
          <tbody>
            {data?.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-semibold">{o.full_name}<div className="text-xs text-muted-foreground">{o.phone}</div></td>
                <td className="p-3">{o.districts?.name ?? "—"}</td>
                <td className="p-3"><span className={o.on_duty ? "text-success" : "text-muted-foreground"}>{o.on_duty ? "● On duty" : "○ Off"}</span></td>
                <td className="p-3 font-bold">{o.open}</td>
                <td className="p-3">{o.resolved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
