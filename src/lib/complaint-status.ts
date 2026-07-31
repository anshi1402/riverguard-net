export type Rank = "vao" | "tahsildar" | "rdo" | "collector";

/** Stage-wise SLA windows (hours). Collector is the final authority. */
export const SLA_HOURS: Record<Rank, number> = { vao: 48, tahsildar: 72, rdo: 72, collector: 72 };

export const NEXT_RANK: Record<Rank, Rank | null> = { vao: "tahsildar", tahsildar: "rdo", rdo: "collector", collector: null };

export const STATUS_LABEL: Record<string, string> = {
  submitted: "Pending",
  pending: "Pending",
  assigned: "Assigned",
  under_verification: "Under Verification",
  in_progress: "In Progress",
  escalated: "Escalated",
  reinvestigate: "Re-investigation",
  reinvestigating: "Re-investigation",
  resolved: "Resolved",
  rejected: "Rejected",
  closed: "Closed",
  sla_breached: "SLA Breached",
};

export const TERMINAL = ["resolved", "rejected", "closed"];

export function isBreached(c: any, now = Date.now()) {
  if (TERMINAL.includes(c.status)) return false;
  return c.status === "sla_breached" || new Date(c.sla_deadline).getTime() < now;
}

export function isPending(c: any) {
  return ["submitted", "pending", "assigned", "escalated"].includes(c.status);
}

/** Counts used by the Complaint Status Analysis cards / statistics charts. */
export function statusCounts(rows: any[], now = Date.now()) {
  const c = {
    total: rows.length,
    escalated: rows.filter((r) => (r.escalation_level ?? 0) > 0).length,
    pending: rows.filter(isPending).length,
    under_verification: rows.filter((r) => r.status === "under_verification").length,
    in_progress: rows.filter((r) => ["in_progress", "reinvestigate", "reinvestigating"].includes(r.status)).length,
    resolved: rows.filter((r) => r.status === "resolved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    closed: rows.filter((r) => r.status === "closed").length,
    breached: rows.filter((r) => isBreached(r, now)).length,
  };
  return c;
}

export function daysOverdue(deadline: string, now = Date.now()) {
  const diff = now - new Date(deadline).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000);
}
