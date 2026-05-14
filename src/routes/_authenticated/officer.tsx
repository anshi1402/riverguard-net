import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, ListChecks, Map, Bell } from "lucide-react";
import { RoleShell } from "@/components/app/RoleShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/officer")({ component: Layout });

function Layout() {
  const { role, loading } = useAuth();
  if (!loading && role && role !== "officer") return <Navigate to={role === "admin" ? "/admin" : "/citizen"} />;
  return (
    <RoleShell brand="Officer Console" items={[
      { to: "/officer",        label: "My Dashboard",       icon: LayoutDashboard },
      { to: "/officer/queue",  label: "Assigned Complaints",icon: ListChecks },
      { to: "/officer/map",    label: "Map View",           icon: Map },
      { to: "/officer/notifications", label: "Notifications", icon: Bell },
    ]}>
      <Outlet />
    </RoleShell>
  );
}
