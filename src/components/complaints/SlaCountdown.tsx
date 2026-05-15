import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function SlaCountdown({ deadline, resolved }: { deadline: string; resolved?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  if (resolved) return <span className="text-xs font-medium text-success">Resolved on time</span>;
  const diff = new Date(deadline).getTime() - Date.now();
  const breached = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return (
    <span className={cn("text-xs font-semibold", breached ? "text-destructive" : h < 6 ? "text-warning-foreground" : "text-muted-foreground")}>
      {breached ? `Overdue ${h}h ${m}m` : `${h}h ${m}m left`}
    </span>
  );
}