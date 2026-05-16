import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Droplets, Shield, Users, MapPin, Clock, Eye, Bot, ArrowRight, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, RANK_LABEL, type OfficerRank } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Landing });

type Tab = "authority" | "citizen";

const RANK_DEMO: Record<OfficerRank, { email: string; password: string }> = {
  vao:        { email: "vao@bluegeo.gov.in",        password: "Authority@1234" },
  tahsildar:  { email: "tahsildar@bluegeo.gov.in",  password: "Authority@1234" },
  rdo:        { email: "rdo@bluegeo.gov.in",        password: "Authority@1234" },
  collector:  { email: "collector@bluegeo.gov.in",  password: "Authority@1234" },
  wrd:        { email: "wrd@bluegeo.gov.in",        password: "Authority@1234" },
};
const CITIZEN_DEMO = { email: "citizen@bluegeo.gov.in", password: "Citizen@1234" };

function Landing() {
  const { user, role, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("authority");
  const [rank, setRank] = useState<OfficerRank>("vao");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(RANK_DEMO.vao.email);
  const [password, setPassword] = useState(RANK_DEMO.vao.password);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("Tirunelveli");
  const [busy, setBusy] = useState(false);

  if (!loading && user && role) {
    return <Navigate to={role === "admin" ? "/admin" : role === "officer" ? "/officer" : "/citizen"} />;
  }

  const switchTab = (t: Tab) => {
    setTab(t);
    setMode("signin");
    if (t === "authority") { setEmail(RANK_DEMO[rank].email); setPassword(RANK_DEMO[rank].password); }
    else { setEmail(CITIZEN_DEMO.email); setPassword(CITIZEN_DEMO.password); }
  };
  const switchRank = (r: OfficerRank) => {
    setRank(r);
    setEmail(RANK_DEMO[r].email);
    setPassword(RANK_DEMO[r].password);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      setBusy(false);
      if (error) return toast.error(error);
      toast.success("Welcome back");
    } else {
      const meta = tab === "citizen"
        ? { full_name: fullName, phone, role: "citizen" as const, district }
        : { full_name: fullName, phone, role: "officer" as const, district, officer_rank: rank };
      const { error } = await signUp(email, password, meta);
      setBusy(false);
      if (error) return toast.error(error);
      toast.success("Account created — signing in...");
      await signIn(email, password);
    }
  };

  const tabs: { id: Tab; label: string; sub: string; icon: typeof Shield }[] = [
    { id: "authority", label: "Authority", sub: "Government officers", icon: Shield },
    { id: "citizen",   label: "Citizen",   sub: "File & track",        icon: Users },
  ];

  return (
    <main className="min-h-screen bg-gradient-hero text-navy-foreground">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
        {/* LEFT — hero */}
        <section className="flex flex-col justify-center">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-elevated">
              <Droplets className="h-7 w-7 text-navy" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">BlueGeo AI</h2>
              <p className="text-sm text-navy-foreground/70">Smart Water Body Protection System — Tamil Nadu</p>
            </div>
          </div>

          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-xs font-medium text-brand">
            <Bot className="h-3.5 w-3.5" /> AI-Powered Water Conservation Platform
          </span>

          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Protecting Tamil Nadu's<br />
            <span className="text-gradient-brand">Water Bodies Together</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-navy-foreground/75">
            Real-time monitoring, geo-tagged complaint management, and automated 48-hour SLA tracking across pilot districts.
          </p>

          <ul className="mt-8 space-y-3 text-base">
            {[
              { icon: MapPin, text: "Geo-tagged complaint submission with GPS" },
              { icon: Clock,  text: "48-hour SLA enforcement with auto-alerts" },
              { icon: Eye,    text: "Live map view of all water body incidents" },
              { icon: Bot,    text: "AI-powered officer accountability system" },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <f.icon className="h-5 w-5 text-brand" />
                <span className="text-navy-foreground/90">{f.text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: "3", l: "Districts" },
              { v: "38+", l: "Water Bodies" },
              { v: "48h", l: "SLA Window" },
              { v: "24/7", l: "Monitoring" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-brand/20 bg-navy/40 px-5 py-4 backdrop-blur">
                <div className="text-2xl font-bold text-brand">{s.v}</div>
                <div className="text-xs uppercase tracking-wide text-navy-foreground/60">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT — sign-in card */}
        <section className="flex items-center">
          <div className="w-full rounded-3xl bg-background p-8 text-foreground shadow-elevated">
            <h3 className="text-2xl font-bold">{mode === "signin" ? "Sign in to your account" : "Create a citizen account"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Choose your role and enter credentials below" : "Citizens can sign up to file and track complaints"}
            </p>

            {mode === "signin" && (
              <>
                <p className="mt-6 text-sm font-medium">Login as</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {tabs.map((r) => {
                    const active = tab === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => switchTab(r.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition",
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                        )}
                      >
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          <r.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{r.label}</div>
                          <div className="text-[11px] leading-tight text-muted-foreground">{r.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {tab === "authority" && (
                  <div className="mt-5 space-y-2">
                    <Label htmlFor="rank">Select Your Role</Label>
                    <select id="rank" value={rank} onChange={(e) => switchRank(e.target.value as OfficerRank)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-medium">
                      {(Object.keys(RANK_LABEL) as OfficerRank[]).map((k) => <option key={k} value={k}>{RANK_LABEL[k]}</option>)}
                    </select>
                  </div>
                )}

                <div className="mt-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                  <p className="text-warning-foreground/90">
                    <span className="font-semibold">Demo:</span> Credentials auto-filled — just click Sign In.
                  </p>
                </div>
              </>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  {tab === "authority" && (
                    <div className="space-y-2">
                      <Label htmlFor="rank2">Select Your Role</Label>
                      <select id="rank2" value={rank} onChange={(e) => setRank(e.target.value as OfficerRank)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {(Object.keys(RANK_LABEL) as OfficerRank[]).map((k) => <option key={k} value={k}>{RANK_LABEL[k]}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Arun Kumar" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <select id="district" value={district} onChange={(e) => setDistrict(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option>Tirunelveli</option>
                        <option>Thoothukudi</option>
                        <option>Tenkasi</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd">Password</Label>
                <Input id="pwd" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              <Button type="submit" disabled={busy} className="h-12 w-full bg-gradient-primary text-base font-semibold shadow-elevated hover:opacity-95">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === "signin" ? "Sign In" : "Create Account"} <ArrowRight className="ml-1 h-4 w-4" /></>}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-primary hover:underline">
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </p>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Tamil Nadu Water Body Protection Authority © 2026<br />
              Powered by BlueGeo AI Platform
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
