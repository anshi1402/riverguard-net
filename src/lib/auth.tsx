import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "officer" | "citizen";
export type OfficerRank = "vao" | "tahsildar" | "rdo" | "collector";
export const RANK_LABEL: Record<OfficerRank, string> = {
  vao: "Village Administrative Officer (VAO)",
  tahsildar: "Tahsildar",
  rdo: "Revenue Divisional Officer (RDO)",
  collector: "District Collector",
};

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  district_id: string | null;
  avatar_url: string | null;
  on_duty: boolean;
  officer_rank: OfficerRank | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, meta: { full_name: string; phone: string; role: AppRole; district?: string; officer_rank?: OfficerRank }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRoleAndProfile = async (uid: string) => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    setRole((r?.role as AppRole) ?? null);
    setProfile(p ? (p as unknown as Profile) : null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { loadRoleAndProfile(s.user.id); }, 0);
      } else {
        setRole(null); setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) loadRoleAndProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthCtx["signUp"] = async (email, password, meta) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: meta },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const refresh = async () => { if (user) await loadRoleAndProfile(user.id); };

  return <Ctx.Provider value={{ user, session, role, profile, loading, signIn, signUp, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
