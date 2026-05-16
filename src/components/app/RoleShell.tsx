import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Droplets, LogOut, Bell } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useAuth, RANK_LABEL } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem { to: string; label: string; icon: ComponentType<{ className?: string }> }

export function RoleShell({ items, brand, children }: { items: NavItem[]; brand: string; children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const rankLabel = profile?.officer_rank ? RANK_LABEL[profile.officer_rank] : null;
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen w-full bg-secondary/30">
      <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 border-b border-sidebar-border p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand"><Droplets className="h-5 w-5 text-navy" /></div>
          <div>
            <div className="font-bold">BlueGeo AI</div>
            <div className="text-xs text-sidebar-foreground/60">{brand}</div>
          </div>
        </div>
        <div className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-navy">
              {(profile?.full_name ?? "U").slice(0,1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{profile?.full_name ?? "User"}</div>
              <div className="truncate text-xs text-sidebar-foreground/60">{rankLabel ?? (role ?? "")}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            return (
              <Link key={it.to} to={it.to} className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/85 hover:bg-sidebar-accent",
              )}>
                <it.icon className="h-4 w-4" />
                <span className="font-medium">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
          <div className="text-sm">Welcome back, <span className="font-semibold">{profile?.full_name ?? "User"}</span></div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-full p-2 hover:bg-muted"><Bell className="h-5 w-5" /></button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
