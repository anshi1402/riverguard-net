import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/citizen/")({ component: Page });

function Page() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-citizen p-8 text-primary-foreground shadow-elevated">
        <div className="text-2xl font-bold">Hello, {profile?.full_name ?? "Citizen"}! 👋</div>
        <p className="mt-1 text-primary-foreground/80">Help us protect Tamil Nadu's water bodies</p>
        <Link to="/citizen/file"><Button size="lg" className="mt-5 bg-background text-primary hover:bg-background/90"><Plus className="mr-2 h-4 w-4" /> Report a Complaint</Button></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ l: "Filed", v: 0 }, { l: "In Progress", v: 0 }, { l: "Resolved", v: 0 }].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-6 shadow-card">
            <div className="text-3xl font-bold">{s.v}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground shadow-card">
        File-complaint flow with geo-tagged camera, complaint tracking, and re-investigation come online next. The backend, auth, and 38+ water bodies are already wired.
      </div>
    </div>
  );
}
