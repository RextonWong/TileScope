import { NextRequest, NextResponse } from "next/server";
import { analyzeTile, type TilePhotoInput } from "@/lib/gemini";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

const MAX_IMAGE_B64_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_MAX = 15;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(ip, RATE_LIMIT_MAX);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before analysing again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { photos } = body as Record<string, unknown>;

  if (!Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json(
      { error: "photos must be a non-empty array of { base64, mime?, label? } objects" },
      { status: 400 }
    );
  }

  if (photos.length > 3) {
    return NextResponse.json({ error: "Maximum 3 photos per analysis" }, { status: 400 });
  }

  const photoInputs: TilePhotoInput[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i] as Record<string, unknown>;
    if (typeof p.base64 !== "string" || !p.base64) {
      return NextResponse.json({ error: `photos[${i}].base64 is required` }, { status: 400 });
    }
    if (p.base64.length > MAX_IMAGE_B64_BYTES) {
      return NextResponse.json({ error: `photos[${i}] exceeds the 5 MB limit` }, { status: 413 });
    }
    photoInputs.push({
      base64: p.base64,
      mime: typeof p.mime === "string" ? p.mime : "image/jpeg",
      label: typeof p.label === "string" ? p.label : undefined,
    });
  }

  try {
    const analysis = await analyzeTile(photoInputs);
    if (!analysis.is_tile) {
      return NextResponse.json(
        { error: "Image does not appear to show a ceramic tile. Please upload a photo of an actual tile." },
        { status: 422 }
      );
    }
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze] error:", err);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
