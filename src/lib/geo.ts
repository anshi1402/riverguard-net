import exifr from "exifr";

export interface GeoPoint { lat: number; lng: number }

export async function extractExifGps(file: File): Promise<GeoPoint | null> {
  try {
    const gps = await exifr.gps(file);
    if (!gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number") return null;
    return { lat: gps.latitude, lng: gps.longitude };
  } catch { return null; }
}

export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function stampImageWithGeo(blob: Blob, geo: GeoPoint): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img load")); img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const pad = Math.round(canvas.width * 0.012);
  const fontSize = Math.max(14, Math.round(canvas.width * 0.022));
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const lines = [
    `Lat ${geo.lat.toFixed(6)},  Lng ${geo.lng.toFixed(6)}`,
    new Date().toLocaleString(),
    "BlueGeo AI · Geo-tagged",
  ];
  const lh = Math.round(fontSize * 1.35);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
  const h = lh * lines.length + pad * 1.5;
  const x = pad;
  const y = canvas.height - h - pad;
  ctx.fillStyle = "rgba(8,18,40,0.78)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#ffffff";
  lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + lh * (i + 0.85)));
  URL.revokeObjectURL(url);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}