import { useRef, useState } from "react";
import { Upload, MapPin, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractExifGps, getCurrentPosition, stampImageWithGeo, type GeoPoint } from "@/lib/geo";

export function GeoUploader({ onPicked }: { onPicked: (file: File, geo: GeoPoint) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsLoc, setNeedsLoc] = useState<File | null>(null);

  const handle = async (f: File) => {
    setBusy(true); setErr(null); setNeedsLoc(null);
    const geo = await extractExifGps(f);
    setBusy(false);
    if (geo) { onPicked(f, geo); return; }
    // Fallback: many phone galleries / messaging apps strip EXIF GPS.
    // Offer to tag the photo using the device's current location.
    setNeedsLoc(f);
    setErr("This image has no GPS EXIF (often stripped by phones / WhatsApp). Tap below to attach your current location instead.");
  };

  const tagWithCurrentLocation = async () => {
    if (!needsLoc) return;
    setBusy(true); setErr(null);
    try {
      const geo = await getCurrentPosition();
      const stamped = await stampImageWithGeo(needsLoc, geo);
      const file = new File([stamped], needsLoc.name.replace(/\.[^.]+$/, "") + "-geotagged.jpg", { type: "image/jpeg" });
      onPicked(file, geo);
      setNeedsLoc(null);
    } catch (e: any) {
      setErr(e.message ?? "Could not read your location. Please allow location access.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={busy} className="h-28 w-full flex-col gap-2 rounded-xl border-dashed">
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        <span className="text-sm font-semibold">Upload Image</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> EXIF GPS or current location</span>
      </Button>
      {err && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</p>}
      {needsLoc && (
        <Button type="button" size="sm" onClick={tagWithCurrentLocation} disabled={busy} className="mt-2 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1 h-4 w-4" /> Use my current location for this photo</>}
        </Button>
      )}
    </div>
  );
}
