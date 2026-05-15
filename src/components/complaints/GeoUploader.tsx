import { useRef, useState } from "react";
import { Upload, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractExifGps, type GeoPoint } from "@/lib/geo";

export function GeoUploader({ onPicked }: { onPicked: (file: File, geo: GeoPoint) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (f: File) => {
    setBusy(true); setErr(null);
    const geo = await extractExifGps(f);
    setBusy(false);
    if (!geo) { setErr("This image is missing GPS data. Please use the in-app camera or upload a geo-tagged photo."); return; }
    onPicked(f, geo);
  };

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={busy} className="h-28 w-full flex-col gap-2 rounded-xl border-dashed">
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        <span className="text-sm font-semibold">Upload Image</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> Must contain GPS EXIF</span>
      </Button>
      {err && <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</p>}
    </div>
  );
}