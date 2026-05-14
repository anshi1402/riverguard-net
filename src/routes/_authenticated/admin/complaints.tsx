import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/complaints")({
  component: () => <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground shadow-card">Coming next — complaints screen</div>,
});
