import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GeoCamera } from "@/components/complaints/GeoCamera";
import { GeoUploader } from "@/components/complaints/GeoUploader";
import { toast } from "sonner";
import type { GeoPoint } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/citizen/file")({ component: Page });

const TYPES = [
  { v: "encroachment", l: "Encroachment" },
  { v: "contamination", l: "Water Contamination" },
  { v: "dead_fish", l: "Dead Fish" },
  { v: "oil_spill", l: "Oil Spill" },
  { v: "sewage", l: "Sewage Discharge" },
  { v: "other", l: "Other" },
];

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [districtId, setDistrictId] = useState("");
  const [waterBodyId, setWaterBodyId] = useState("");
  const [type, setType] = useState("encroachment");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [geo, setGeo] = useState<GeoPoint | null>(null);

  const { data: districts } = useQuery({
    queryKey: ["districts"],
    queryFn: async () => (await supabase.from("districts").select("id,name").order("name")).data ?? [],
  });
  const { data: waterBodies } = useQuery({
    queryKey: ["water_bodies", districtId],
    enabled: !!districtId,
    queryFn: async () => (await supabase.from("water_bodies").select("id,name,type").eq("district_id", districtId).order("name")).data ?? [],
  });

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!districtId || !waterBodyId) throw new Error("Pick district and water body");
      if (!description.trim()) throw new Error("Add a description");
      if (!file || !geo) throw new Error("Add a geo-tagged photo");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("complaint-photos").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("complaint-photos").getPublicUrl(path);
      const ins = await supabase.from("complaints").insert({
        citizen_id: user.id, district_id: districtId, water_body_id: waterBodyId,
        type: type as any, severity: severity as any, description, image_url: pub.publicUrl,
        lat: geo.lat, lng: geo.lng,
      }).select("code").single();
      if (ins.error) throw ins.error;
      return ins.data.code as string;
    },
    onSuccess: (code) => { toast.success(`Complaint ${code} filed`); navigate({ to: "/citizen/track" }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">File a Complaint</h1>
        <p className="text-sm text-muted-foreground">Report an issue with a water body. A geo-tagged photo is required.</p>
      </div>

      <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>District</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={districtId} onChange={(e) => { setDistrictId(e.target.value); setWaterBodyId(""); }}>
              <option value="">Select district…</option>
              {districts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Water Body</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50" value={waterBodyId} onChange={(e) => setWaterBodyId(e.target.value)} disabled={!districtId}>
              <option value="">{districtId ? `Select water body (${waterBodies?.length ?? 0})` : "Pick district first"}</option>
              {waterBodies?.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.type}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Complaint Type</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Severity</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you observed…" />
        </div>

        <div className="space-y-2">
          <Label>Geo-tagged Evidence Photo</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <GeoUploader onPicked={(f, g) => { setFile(f); setGeo(g); }} />
            <GeoCamera onCapture={(f, g) => { setFile(f); setGeo(g); }} />
          </div>
          {preview && geo && (
            <div className="mt-3 flex gap-3 rounded-xl border bg-muted/40 p-3">
              <img src={preview} alt="evidence" className="h-24 w-32 rounded-md object-cover" />
              <div className="text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Geo-tag verified</div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</div>
              </div>
            </div>
          )}
          {!geo && file === null && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> Uploaded photos must contain GPS EXIF, or use the in-app camera.</p>
          )}
        </div>

        <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full bg-gradient-primary text-base font-semibold">
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Complaint"}
        </Button>
      </div>
    </div>
  );
}
