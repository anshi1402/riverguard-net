import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "./StatusBadge";

export function ComplaintMap({ districtId }: { districtId?: string }) {
  const { data } = useQuery({
    queryKey: ["map-complaints", districtId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("complaints").select("id, code, status, lat, lng, water_bodies(name), districts(name)").not("lat", "is", null);
      if (districtId) q = q.eq("district_id", districtId);
      return (await q).data ?? [];
    },
  });
  const points = (data ?? []).filter((c: any) => c.lat && c.lng);
  if (points.length === 0) return <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-card">No geo-tagged complaints to display.</div>;
  // Bounding box
  const lats = points.map((p: any) => p.lat as number);
  const lngs = points.map((p: any) => p.lng as number);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = (maxLat - minLat) * 0.1 || 0.05;
  const padLng = (maxLng - minLng) * 0.1 || 0.05;
  const w = 800, h = 500;
  const x = (lng: number) => ((lng - (minLng - padLng)) / ((maxLng + padLng) - (minLng - padLng))) * w;
  const y = (lat: number) => h - ((lat - (minLat - padLat)) / ((maxLat + padLat) - (minLat - padLat))) * h;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-navy/40 dark:to-navy/60">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" /></pattern></defs>
          <rect width={w} height={h} fill="url(#grid)" />
          {points.map((p: any) => {
            const color = p.status === "resolved" ? "#10b981" : p.status === "in_progress" ? "#f59e0b" : "#ef4444";
            return <g key={p.id}><circle cx={x(p.lng)} cy={y(p.lat)} r={10} fill={color} fillOpacity={0.3} /><circle cx={x(p.lng)} cy={y(p.lat)} r={5} fill={color} /></g>;
          })}
        </svg>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-2 min-w-0"><MapPin className="h-3 w-3 shrink-0" /><span className="font-mono font-bold text-primary">{p.code}</span><span className="truncate">{p.water_bodies?.name}</span></div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  );
}