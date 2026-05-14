import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Users, Activity, Map, Droplets, Bell } from "lucide-react";
import { RoleShell } from "@/components/app/RoleShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({ component: Layout });

function Layout() {
  const { role, loading } = useAuth();
  if (!loading && role && role !== "admin") return <Navigate to={role === "officer" ? "/officer" : "/citizen"} />;
  return (
    <RoleShell brand="Water Body Protection" items={[
      { to: "/admin",            label: "Dashboard",       icon: LayoutDashboard },
      { to: "/admin/complaints", label: "Complaints",      icon: FileText },
      { to: "/admin/officers",   label: "Officer Tracking",icon: Users },
      { to: "/admin/sla",        label: "SLA Monitoring",  icon: Activity },
      { to: "/admin/map",        label: "Map View",        icon: Map },
      { to: "/admin/water-bodies", label: "Water Bodies",  icon: Droplets },
      { to: "/admin/notifications", label: "Notifications",icon: Bell },
    ]}>
      <Outlet />
    </RoleShell>
  );
}
