import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().min(32),
  complaintType: z.string().min(1),
});

export interface ImageVerdict {
  ok: boolean;
  confidence: number;
  category: string | null;
  reason: string;
}

const SYSTEM = `You are an image classifier for a water-body encroachment complaint system in Tamil Nadu, India.
Decide if the photo genuinely shows one of these: water body encroachment; illegal construction inside/near a water body; garbage dumping into water; sewage discharge; water pollution; sand mining; blocked drainage or canals; water body obstruction; industrial waste disposal into water; any environmental issue affecting lakes, rivers, ponds, canals, reservoirs or wetlands.
Reject selfies, portraits, pets/animals, unrelated buildings, vehicles, screenshots, documents, food, memes and any photo with no visible water body or environmental issue.
Respond with ONLY compact JSON: {"related":boolean,"confidence":number between 0 and 1,"category":string|null,"reason":short string}`;

export const validateComplaintImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ImageVerdict> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI validation is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `Selected complaint category: ${data.complaintType}. Classify this photo.` },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI validation is busy right now. Please retry in a moment.");
      if (res.status === 402) throw new Error("AI validation credits exhausted. Please contact the administrator.");
      throw new Error(`Image validation failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, confidence: 0, category: null, reason: "Could not analyze the image. Please try another photo." };

    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch {
      return { ok: false, confidence: 0, category: null, reason: "Could not analyze the image. Please try another photo." };
    }

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const related = parsed.related === true;
    return {
      ok: related && confidence >= 0.8,
      confidence,
      category: typeof parsed.category === "string" ? parsed.category : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  });
