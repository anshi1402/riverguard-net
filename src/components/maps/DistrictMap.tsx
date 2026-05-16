import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Droplets, MapPin, AlertTriangle, Satellite } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { cn } from "@/lib/utils";

interface Props { districtId?: string; allowDistrictSwitch?: boolean }

export function DistrictMap({ districtId: initialDistrict, allowDistrictSwitch }: Props) {
  const [districtId, setDistrictId] = useState(initialDistrict ?? "");
  const [show, setShow] = useState({ wb: true, complaints: true, alerts: true });

  useEffect(() => { if (initialDistrict) setDistrictId(initialDistrict); }, [initialDistrict]);

  const { data: districts } = useQuery({
    queryKey: ["districts-map"],
    queryFn: async () => (await supabase.from("districts").select("id,name").order("name")).data ?? [],
    enabled: !!allowDistrictSwitch,
  });

  useEffect(() => {
    if (allowDistrictSwitch && !districtId && districts && districts.length > 0) setDistrictId(districts[0].id);
  }, [allowDistrictSwitch, districtId, districts]);

  const { data: waterBodies } = useQuery({
    queryKey: ["map-wb", districtId],
    enabled: !!districtId,
    queryFn: async () => (await supabase.from("water_bodies").select("id,name,type,lat,lng,risk_level").eq("district_id", districtId)).data ?? [],
  });
  const { data: complaints } = useQuery({
    queryKey: ["map-complaints", districtId],
    enabled: !!districtId,
    queryFn: async () => (await supabase.from("complaints").select("id,code,status,severity,lat,lng,type,water_bodies(name)").eq("district_id", districtId).not("lat", "is", null)).data ?? [],
  });
  const { data: alerts } = useQuery({
    queryKey: ["map-alerts", districtId],
    enabled: !!districtId,
    queryFn: async () => (await supabase.from("ai_alerts").select("id,title,source,severity,lat,lng,water_bodies(name)").eq("district_id", districtId)).data ?? [],
  });

  const points = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    (waterBodies ?? []).forEach((w: any) => w.lat && pts.push({ lat: w.lat, lng: w.lng }));
    (complaints ?? []).forEach((c: any) => c.lat && pts.push({ lat: c.lat, lng: c.lng }));
    (alerts ?? []).forEach((a: any) => a.lat && pts.push({ lat: a.lat, lng: a.lng }));
    return pts;
  }, [waterBodies, complaints, alerts]);

  if (!districtId) return <Empty msg="Select a district to view the map." />;
  if (points.length === 0) return <Empty msg="No geo-data available for this district yet." />;

  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.02);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.02);
  const W = 900, H = 540;
  const x = (lng: number) => ((lng - (minLng - padLng)) / ((maxLng + padLng) - (minLng - padLng))) * W;
  const y = (lat: number) => H - ((lat - (minLat - padLat)) / ((maxLat + padLat) - (minLat - padLat))) * H;

  const districtName = districts?.find((d) => d.id === districtId)?.name ?? "";

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          {allowDistrictSwitch && districts && (
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {districtName && !allowDistrictSwitch && <div className="text-sm font-semibold">{districtName} District</div>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Toggle on={show.wb} onClick={() => setShow((s) => ({ ...s, wb: !s.wb }))} color="text-sky-500"><Droplets className="h-3.5 w-3.5" /> Water Bodies ({waterBodies?.length ?? 0})</Toggle>
          <Toggle on={show.complaints} onClick={() => setShow((s) => ({ ...s, complaints: !s.complaints }))} color="text-rose-500"><MapPin className="h-3.5 w-3.5" /> Complaints ({complaints?.length ?? 0})</Toggle>
          <Toggle on={show.alerts} onClick={() => setShow((s) => ({ ...s, alerts: !s.alerts }))} color="text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> AI Alerts ({alerts?.length ?? 0})</Toggle>
        </div>
      </div>

      <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 dark:from-navy/50 dark:via-navy/60 dark:to-navy/70">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <pattern id="dgrid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
            </pattern>
            <radialGradient id="pulse" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#dgrid)" />
          {/* district boundary box */}
          <rect x={20} y={20} width={W - 40} height={H - 40} rx="22" fill="rgba(56,189,248,0.06)" stroke="rgba(14,165,233,0.45)" strokeDasharray="6 6" />
          <text x={32} y={42} fontSize="13" fontWeight="700" fill="rgba(14,165,233,0.7)">{districtName} District</text>

          {/* Water bodies */}
          {show.wb && (waterBodies ?? []).map((w: any) => w.lat && (
            <g key={w.id}>
              <circle cx={x(w.lng)} cy={y(w.lat)} r={14} fill="#38bdf8" fillOpacity={0.25} />
              <circle cx={x(w.lng)} cy={y(w.lat)} r={7} fill="#0284c7" />
              <text x={x(w.lng) + 11} y={y(w.lat) + 4} fontSize="10" fontWeight="600" fill="currentColor">{w.name}</text>
            </g>
          ))}

          {/* AI alerts (pulse) */}
          {show.alerts && (alerts ?? []).map((a: any) => a.lat && (
            <g key={a.id}>
              <circle cx={x(a.lng)} cy={y(a.lat)} r={24} fill="url(#pulse)">
                <animate attributeName="r" values="14;28;14" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={x(a.lng)} cy={y(a.lat)} r={6} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            </g>
          ))}

          {/* Complaints */}
          {show.complaints && (complaints ?? []).map((c: any) => {
            const color = c.status === "resolved" ? "#10b981" : c.status === "in_progress" ? "#f59e0b" : "#ef4444";
            return (
              <g key={c.id}>
                <circle cx={x(c.lng)} cy={y(c.lat)} r={10} fill={color} fillOpacity={0.3} />
                <circle cx={x(c.lng)} cy={y(c.lat)} r={5} fill={color} stroke="#fff" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>
      </div>

      <Legend />

      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {show.complaints && (complaints ?? []).map((c: any) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
            <div className="flex min-w-0 items-center gap-2"><MapPin className="h-3 w-3 shrink-0 text-rose-500" /><span className="font-mono font-bold text-primary">{c.code}</span><span className="truncate">{c.water_bodies?.name}</span></div>
            <StatusBadge status={c.status} />
          </div>
        ))}
        {show.alerts && (alerts ?? []).map((a: any) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg bg-amber-500/10 p-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              {a.source === "satellite" ? <Satellite className="h-3 w-3 shrink-0 text-amber-600" /> : <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />}
              <span className="truncate">{a.title}</span>
            </div>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">{a.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, color, children }: any) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition", on ? "bg-card " + color : "bg-muted/40 text-muted-foreground line-through")}>{children}</button>
  );
}
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> Water body</span>
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Open complaint</span>
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> In progress</span>
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Resolved</span>
      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300" /> AI alert</span>
    </div>
  );
}
function Empty({ msg }: { msg: string }) { return <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">{msg}</div>; }