import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  submitted:    { label: "Submitted",    cls: "bg-primary/15 text-primary" },
  assigned:     { label: "Assigned",     cls: "bg-accent text-accent-foreground" },
  in_progress:  { label: "In Progress",  cls: "bg-warning/20 text-warning-foreground" },
  resolved:     { label: "Resolved",     cls: "bg-success/20 text-success" },
  reinvestigate:{ label: "Re-investigate", cls: "bg-destructive/15 text-destructive" },
  sla_breached: { label: "SLA Breached", cls: "bg-destructive/20 text-destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", m.cls)}>{m.label}</span>;
}