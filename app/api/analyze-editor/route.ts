import { NextRequest, NextResponse } from "next/server";
import { analyzeTileEditor } from "@/lib/gemini";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import type { TileSurfaceId } from "@/lib/tile";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SurfaceInput {
  base64: string;
  mime?: string;
}

interface RequestBody {
  surfaces: Partial<Record<TileSurfaceId, SurfaceInput>>;
}

export async function POST(req: NextRequest) {
  // Rate limit: 10/min per IP for editor
  const ip = clientIp(req);
  const rl = checkRateLimit(`editor:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${rl.retryAfterSec ?? 60}s.` },
      { status: 429 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.surfaces || typeof body.surfaces !== "object") {
    return NextResponse.json({ error: "surfaces object is required." }, { status: 400 });
  }

  const surfaceOrder: TileSurfaceId[] = ["face", "top_edge", "bottom_edge", "left_edge", "right_edge"];
  const photos: { base64: string; mime: string; label: string }[] = [];

  for (const sid of surfaceOrder) {
    const s = body.surfaces[sid];
    if (!s?.base64) continue;
    if (s.base64.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: `Surface '${sid}' exceeds 10 MB.` }, { status: 400 });
    }
    photos.push({ base64: s.base64, mime: s.mime ?? "image/jpeg", label: sid });
  }

  if (photos.length === 0) {
    return NextResponse.json({ error: "At least one rendered surface image is required." }, { status: 400 });
  }

  try {
    const analysis = await analyzeTileEditor(photos);
    return NextResponse.json(analysis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
