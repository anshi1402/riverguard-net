import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, ListChecks, Map, Bell, Brain, BarChart3 } from "lucide-react";
import { RoleShell } from "@/components/app/RoleShell";
import { useAuth } from "@/lib/auth";
import type { NavItem } from "@/components/app/RoleShell";

export const Route = createFileRoute("/_authenticated/officer")({ component: Layout });

function Layout() {
  const { role, loading, profile } = useAuth();
  if (!loading && role && role !== "officer") return <Navigate to={role === "admin" ? "/admin" : "/citizen"} />;
  const rank = profile?.officer_rank ?? "vao";

  const items: NavItem[] = [{ to: "/officer", label: "My Dashboard", icon: LayoutDashboard }];
  if (rank === "vao") {
    items.push({ to: "/officer/queue", label: "Assigned Complaints", icon: ListChecks });
  } else if (rank === "tahsildar" || rank === "rdo") {
    items.push({ to: "/officer/queue", label: "Escalated Complaints", icon: ListChecks });
  } else {
    items.push({ to: "/officer/analytics", label: "Complaint Analytics", icon: BarChart3 });
  }
  items.push({ to: "/officer/ai-alerts", label: "AI Alerts", icon: Brain });
  if (rank !== "vao") items.push({ to: "/officer/map", label: "Map View", icon: Map });
  items.push({ to: "/officer/notifications", label: "Notifications", icon: Bell });

  return (
    <RoleShell brand="Authority Console" items={items}>
      <Outlet />
    </RoleShell>
  );
}
