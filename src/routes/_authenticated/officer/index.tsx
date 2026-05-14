import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/officer/")({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Officer Dashboard</h1>
        <p className="text-sm text-muted-foreground">Field officer · Tamil Nadu Pollution Control Board</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { l: "Assigned", v: 0, c: "bg-primary/10 text-primary" },
          { l: "In Progress", v: 0, c: "bg-warning/15 text-warning-foreground" },
          { l: "Resolved Today", v: 0, c: "bg-success/15 text-success" },
          { l: "Overdue", v: 0, c: "bg-destructive/10 text-destructive" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="text-sm text-muted-foreground">{s.l}</div>
            <div className="mt-2 text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground shadow-card">Assigned-complaints queue with 48h SLA countdowns ships next.</div>
    </div>
  ),
});
