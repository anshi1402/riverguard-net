import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, FileText, Search, ShieldAlert, XCircle } from "lucide-react";
import { statusCounts, daysOverdue, isBreached } from "@/lib/complaint-status";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { SlaCountdown } from "@/components/complaints/SlaCountdown";

const SERIES_COLORS = ["var(--primary)", "var(--accent-foreground)", "var(--warning)", "var(--success)", "var(--muted-foreground)", "var(--destructive)"];

export function StatusAnalysis({ rows, scopeNote }: { rows: any[]; scopeNote: string }) {
  const now = Date.now();
  const c = statusCounts(rows, now);

  const cards = [
    { label: "Total Escalated Complaints", value: c.escalated, icon: FileText, tone: "bg-primary/10 text-primary" },
    { label: "Pending", value: c.pending, icon: Clock, tone: "bg-primary/10 text-primary" },
    { label: "Under Verification", value: c.under_verification, icon: Search, tone: "bg-accent text-accent-foreground" },
    { label: "In Progress", value: c.in_progress, icon: AlertTriangle, tone: "bg-warning/15 text-warning-foreground" },
    { label: "Resolved", value: c.resolved, icon: CheckCircle2, tone: "bg-success/15 text-success" },
    { label: "Rejected", value: c.rejected, icon: XCircle, tone: "bg-muted text-muted-foreground" },
    { label: "SLA Breached", value: c.breached, icon: ShieldAlert, tone: "bg-destructive/15 text-destructive" },
  ];

  const chartData = [
    { name: "Pending", value: c.pending },
    { name: "Under Verification", value: c.under_verification },
    { name: "In Progress", value: c.in_progress },
    { name: "Resolved", value: c.resolved },
    { name: "Rejected", value: c.rejected },
    { name: "SLA Breached", value: c.breached },
  ];

  const breaches = rows.filter((r) => isBreached(r, now)).sort((a, b) => new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime());

  return (
    <div className="space-y-6">
      {/* Complaint Status Analysis */}
      <section>
        <h2 className="text-base font-semibold">Complaint Status Analysis</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{scopeNote}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {cards.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="h-4 w-4" /></div>
              <div className="mt-3 text-2xl font-bold leading-none">{s.value}</div>
              <div className="mt-1.5 text-xs font-medium text-foreground/80">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Complaint Status Statistics */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="mb-4"><h2 className="text-base font-semibold">Complaint Status Statistics</h2><p className="mt-0.5 text-xs text-muted-foreground">Distribution by status</p></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={54} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="mb-4"><h2 className="text-base font-semibold">Status Share</h2><p className="mt-0.5 text-xs text-muted-foreground">Doughnut view of the same statuses</p></div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={chartData.filter((d) => d.value > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {chartData.filter((d) => d.value > 0).map((_, i) => <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SLA Breach Alerts */}
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <div className="mb-4"><h2 className="text-base font-semibold">SLA Breach Alerts</h2><p className="mt-0.5 text-xs text-muted-foreground">Complaints past their stage deadline</p></div>
        {breaches.length === 0 && <div className="rounded-xl bg-muted/30 p-6 text-center text-sm text-muted-foreground">No SLA breaches at your stage.</div>}
        <div className="space-y-2">
          {breaches.slice(0, 10).map((c2: any) => (
            <div key={c2.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-primary">{c2.code}</span>
                <StatusBadge status={c2.status} />
                <span>{c2.water_bodies?.name} · {c2.districts?.name}</span>
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                  {daysOverdue(c2.sla_deadline, now)}d overdue · L{c2.escalation_level ?? 0}
                </span>
              </div>
              <SlaCountdown deadline={c2.sla_deadline} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
