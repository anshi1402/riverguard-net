import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Home, FilePlus, ListChecks, Bell } from "lucide-react";
import { RoleShell } from "@/components/app/RoleShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/citizen")({ component: Layout });

function Layout() {
  const { role, loading } = useAuth();
  if (!loading && role && role !== "citizen") return <Navigate to={role === "admin" ? "/admin" : "/officer"} />;
  return (
    <RoleShell brand="Citizen Portal" items={[
      { to: "/citizen",          label: "Home",          icon: Home },
      { to: "/citizen/file",     label: "File Complaint",icon: FilePlus },
      { to: "/citizen/track",    label: "My Complaints", icon: ListChecks },
      { to: "/citizen/notifications", label: "Notifications", icon: Bell },
    ]}>
      <Outlet />
    </RoleShell>
  );
}
