import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/citizen/file")({
  component: () => <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground shadow-card">Coming next — file screen</div>,
});
