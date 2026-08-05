import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapPin, Loader2, CheckCircle2, AlertTriangle, XCircle, ScanSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GeoCamera } from "@/components/complaints/GeoCamera";
import { GeoUploader } from "@/components/complaints/GeoUploader";
import { toast } from "sonner";
import type { GeoPoint } from "@/lib/geo";
import { validateComplaintImage, type ImageVerdict } from "@/lib/image-validation.functions";

export const Route = createFileRoute("/_authenticated/citizen/file")({ component: Page });

async function toDataUrl(file: File, maxSide = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Could not read image")); img.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

const TYPES = [
  { v: "encroachment",            l: "Water Body Encroachment (Lake / Tank / Pond)" },
  { v: "supply_channel",          l: "Supply Channel Encroachment" },
  { v: "surplus_channel",         l: "Surplus / Drain Channel Encroachment" },
  { v: "water_flow_obstruction",  l: "Water Flow Obstruction" },
  { v: "illegal_dumping",         l: "Dumping / Waste in Water Bodies" },
];

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [districtId, setDistrictId] = useState("");
  const [waterBodyId, setWaterBodyId] = useState("");
  const [type, setType] = useState("encroachment");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [aiState, setAiState] = useState<"idle" | "checking" | "passed" | "failed">("idle");
  const [aiVerdict, setAiVerdict] = useState<ImageVerdict | null>(null);
  const runValidation = useServerFn(validateComplaintImage);

  const analyze = async (f: File, complaintType: string): Promise<ImageVerdict | null> => {
    setAiState("checking"); setAiVerdict(null);
    try {
      const imageDataUrl = await toDataUrl(f);
      const verdict = await runValidation({ data: { imageDataUrl, complaintType } });
      setAiVerdict(verdict);
      setAiState(verdict.ok ? "passed" : "failed");
      return verdict;
    } catch (e: any) {
      setAiVerdict({ ok: false, confidence: 0, category: null, reason: e?.message ?? "Validation failed" });
      setAiState("failed");
      return null;
    }
  };

  const acceptPhoto = (f: File, g: GeoPoint) => { setFile(f); setGeo(g); void analyze(f, type); };

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
      // Server-side re-validation so the check cannot be bypassed from the browser.
      const verdict = await analyze(file, type);
      if (!verdict?.ok) throw new Error("Image validation failed — upload a valid photo of the reported issue");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("complaint-photos").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("complaint-photos").getPublicUrl(path);
      const ins = await supabase.from("complaints").insert({
        citizen_id: user.id, district_id: districtId, water_body_id: waterBodyId,
        type: type as any, description, image_url: pub.publicUrl,
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
        <p className="text-sm text-muted-foreground">Report water encroachment or related issues. A geo-tagged photo is required. Routed to VAO → Tahsildar → RDO → Collector if unresolved within 48h.</p>
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

        <div className="space-y-2">
          <Label>Type of Water Encroachment</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you observed…" />
        </div>

        <div className="space-y-2">
          <Label>Geo-tagged Evidence Photo</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <GeoUploader onPicked={acceptPhoto} />
            <GeoCamera onCapture={acceptPhoto} />
          </div>
          {file && aiState === "checking" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing image…
            </div>
          )}
          {file && aiState === "passed" && (
            <div className="mt-3 rounded-xl border border-success/40 bg-success/5 p-3 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Image Verified</div>
              <p className="mt-1 text-xs text-muted-foreground">The uploaded image appears to be relevant to the selected complaint.{aiVerdict ? ` (${Math.round(aiVerdict.confidence * 100)}% confidence)` : ""}</p>
            </div>
          )}
          {file && aiState === "failed" && (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-destructive"><XCircle className="h-4 w-4" /> Image Validation Failed</div>
              <p className="mt-1 text-xs text-muted-foreground">This image does not appear to be related to a water body encroachment or environmental complaint. Please upload a valid image showing the reported issue.{aiVerdict?.reason ? ` — ${aiVerdict.reason}` : ""}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => file && analyze(file, type)}>
                <ScanSearch className="mr-1 h-4 w-4" /> Re-run analysis
              </Button>
            </div>
          )}
          {preview && geo && (
            <div className="mt-3 flex flex-wrap gap-3 rounded-xl border border-success/40 bg-success/5 p-3">
              <img src={preview} alt="evidence" className="h-24 w-32 rounded-md object-cover" />
              <div className="text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Geo-tag verified</div>
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Captured {new Date().toLocaleString()}</div>
                <a className="mt-1 inline-block text-xs font-medium text-primary hover:underline" href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`} target="_blank" rel="noreferrer">View location on map</a>
              </div>
            </div>
          )}
          {preview && !geo && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> Location not verified yet — attach your current location or retake the photo with the in-app camera.</p>
          )}
          {!geo && file === null && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> Upload a photo (GPS is read from EXIF, or you can attach your current location) or use the in-app camera.</p>
          )}
        </div>

        <Button
          onClick={() => submit.mutate()}
          disabled={submit.isPending || !geo || !file || aiState !== "passed"}
          className="w-full bg-gradient-primary text-base font-semibold"
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : aiState === "checking" ? "Analyzing image…" : "Submit Complaint"}
        </Button>
        {(!geo || aiState !== "passed") && (
          <p className="text-center text-xs text-muted-foreground">
            {!geo ? "GPS verification is required." : aiState === "failed" ? "AI image validation failed — upload another photo." : "Complete AI image validation to submit."}
          </p>
        )}
      </div>
    </div>
  );
}
