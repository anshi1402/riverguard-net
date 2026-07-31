import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/complaint-status";

const CLS: Record<string, string> = {
  submitted:          "bg-primary/15 text-primary",
  pending:            "bg-primary/15 text-primary",
  assigned:           "bg-accent text-accent-foreground",
  under_verification: "bg-accent text-accent-foreground",
  in_progress:        "bg-warning/20 text-warning-foreground",
  escalated:          "bg-warning/25 text-warning-foreground",
  resolved:           "bg-success/20 text-success",
  closed:             "bg-success/15 text-success",
  rejected:           "bg-destructive/15 text-destructive",
  reinvestigate:      "bg-destructive/15 text-destructive",
  reinvestigating:    "bg-destructive/15 text-destructive",
  sla_breached:       "bg-destructive/20 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", CLS[status] ?? "bg-muted text-muted-foreground")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
