import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export function NotificationsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const r = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100);
      if (r.error) throw r.error; return r.data;
    },
  });
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["notifications"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);
  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Notifications</h1><p className="text-sm text-muted-foreground">Live updates across your role.</p></div>
        <Button variant="outline" size="sm" onClick={markAll}><CheckCircle2 className="mr-1 h-4 w-4" /> Mark all read</Button>
      </div>
      {data?.length === 0 && <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">No notifications yet.</div>}
      <div className="space-y-2">
        {data?.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card ${!n.read ? "border-primary/40 bg-primary/5" : ""}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}