import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentPosition, stampImageWithGeo, type GeoPoint } from "@/lib/geo";
import { toast } from "sonner";

export function GeoCamera({ onCapture }: { onCapture: (file: File, geo: GeoPoint) => void }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      streamRef.current = s;
      setActive(true);
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); } });
    } catch (e) { toast.error("Camera permission denied"); }
  };

  const snap = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    try {
      const geo = await getCurrentPosition();
      const v = videoRef.current;
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const raw: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.92));
      const stamped = await stampImageWithGeo(raw, geo);
      const file = new File([stamped], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file, geo);
      stop();
    } catch (e: any) { toast.error(e.message ?? "Capture failed"); }
    finally { setBusy(false); }
  };

  if (!active) return (
    <Button type="button" variant="outline" onClick={start} className="h-28 w-full flex-col gap-2 rounded-xl border-dashed">
      <Camera className="h-6 w-6" /> <span className="text-sm font-semibold">Take Photo (in-app camera)</span>
      <span className="text-xs text-muted-foreground">GPS will be stamped automatically</span>
    </Button>
  );
  return (
    <div className="rounded-xl border bg-black p-2">
      <div className="relative overflow-hidden rounded-lg">
        <video ref={videoRef} className="aspect-video w-full bg-black" muted playsInline />
        <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium"><MapPin className="h-3 w-3" /> GPS stamp on</div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={snap} disabled={busy} className="flex-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Capture"}</Button>
        <Button type="button" variant="outline" onClick={stop}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}