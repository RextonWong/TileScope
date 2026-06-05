import type { TileSurfaceId, TileDimensions, ZoneId } from "./tile";
import { getTileSurfaceSize } from "./tile";
import type { EditableDefect } from "./tile";

// ── Deterministic RNG ────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

// ── Value noise ───────────────────────────────────────────────────────────────

function makeNoise(seed: number) {
  const rng = mulberry32(seed);
  const size = 256;
  const perm: number[] = [];
  for (let i = 0; i < size; i++) perm.push(Math.floor(rng() * size));
  const grad = (ix: number, iy: number) =>
    (perm[(ix + perm[iy & (size - 1)]) & (size - 1)] / size) * 2 - 1;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return {
    noise: (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = fade(xf), v = fade(yf);
      return lerp(lerp(grad(xi, yi), grad(xi + 1, yi), u),
                  lerp(grad(xi, yi + 1), grad(xi + 1, yi + 1), u), v);
    },
  };
}

function fbm(n: ReturnType<typeof makeNoise>, x: number, y: number, octaves: number): number {
  let sum = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += n.noise(x * freq, y * freq) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return sum / max;
}

// ── Canvas sizing ─────────────────────────────────────────────────────────────

const PX_PER_MM = 5;
const MAX_EDGE_PX = 1280;
const MIN_SHORT_PX = 80;

function pickSize(w_mm: number, h_mm: number) {
  let wPx = Math.round(w_mm * PX_PER_MM);
  let hPx = Math.round(h_mm * PX_PER_MM);
  const longest = Math.max(wPx, hPx);
  if (longest > MAX_EDGE_PX) {
    const s = MAX_EDGE_PX / longest;
    wPx = Math.round(wPx * s); hPx = Math.round(hPx * s);
  }
  if (wPx < MIN_SHORT_PX) { const s = MIN_SHORT_PX / wPx; wPx = MIN_SHORT_PX; hPx = Math.round(hPx * s); }
  if (hPx < MIN_SHORT_PX) { const s = MIN_SHORT_PX / hPx; hPx = MIN_SHORT_PX; wPx = Math.round(wPx * s); }
  return { wPx, hPx };
}

// Decompose hex color "#rrggbb" → { r, g, b } (0-255)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  return { r: 228, g: 225, b: 218 }; // fallback cream
}

// ── Ceramic tile base texture ─────────────────────────────────────────────────

function paintGlazedFace(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  seed: number,
  baseColor?: string
) {
  const nTexture = makeNoise(seed * 1117);
  const nColor = makeNoise(seed * 2311);
  const { r: br, g: bg, b: bb } = hexToRgb(baseColor ?? "#e4e1d8");

  const img = ctx.createImageData(wPx, hPx);
  const data = img.data;

  for (let y = 0; y < hPx; y++) {
    for (let x = 0; x < wPx; x++) {
      const t = fbm(nTexture, x / 40, y / 40, 3) * 0.04;
      const colorVar = fbm(nColor, x / 120, y / 120, 2) * 0.025;
      const base = 0.89 + t + colorVar;
      const r = Math.max(0, Math.min(255, base * br));
      const g = Math.max(0, Math.min(255, base * bg));
      const b = Math.max(0, Math.min(255, base * bb));
      const i = (y * wPx + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const sheen = ctx.createLinearGradient(0, 0, wPx * 0.7, hPx * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.13)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.05)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, wPx, hPx);

  const vig = ctx.createRadialGradient(wPx / 2, hPx / 2, Math.min(wPx, hPx) * 0.3, wPx / 2, hPx / 2, Math.max(wPx, hPx) * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, wPx, hPx);
}

function paintFiredEdge(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, seed: number) {
  const nBody = makeNoise(seed * 777);
  const nGrain = makeNoise(seed * 1553);

  const img = ctx.createImageData(wPx, hPx);
  const data = img.data;

  for (let y = 0; y < hPx; y++) {
    for (let x = 0; x < wPx; x++) {
      const body = fbm(nBody, x / 20, y / 20, 3) * 0.08;
      const grain = fbm(nGrain, x / 4, y / 4, 2) * 0.04;
      const v = 0.78 + body + grain;
      const r = Math.max(0, Math.min(255, v * 200));
      const g = Math.max(0, Math.min(255, v * 162));
      const b = Math.max(0, Math.min(255, v * 120));
      const i = (y * wPx + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const glazeH = Math.max(2, Math.round(hPx * 0.12));
  const glazeGrad = ctx.createLinearGradient(0, 0, 0, glazeH);
  glazeGrad.addColorStop(0, "rgba(228,225,218,0.95)");
  glazeGrad.addColorStop(1, "rgba(228,225,218,0)");
  ctx.fillStyle = glazeGrad;
  ctx.fillRect(0, 0, wPx, glazeH);
}

// ── Defect overlays ───────────────────────────────────────────────────────────

function drawCrack(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  ctx.strokeStyle = "rgba(25, 20, 18, 0.80)";
  ctx.lineWidth = Math.max(1, wPx / 300);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sx = 0.25 + rng() * 0.5, sy = 0.2 + rng() * 0.3;
  ctx.beginPath();
  ctx.moveTo(sx * wPx, sy * hPx);
  let cx = sx, cy = sy;
  const steps = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < steps; i++) {
    cx += (rng() * 0.12 - 0.04);
    cy += 0.06 + rng() * 0.08;
    ctx.lineTo(cx * wPx, cy * hPx);
    if (rng() < 0.35) {
      ctx.moveTo(cx * wPx, cy * hPx);
      const bx = cx + rng() * 0.1 - 0.03;
      const by = cy + 0.04 + rng() * 0.06;
      ctx.lineTo(bx * wPx, by * hPx);
      ctx.moveTo(cx * wPx, cy * hPx);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawCrazing(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  ctx.strokeStyle = "rgba(60, 50, 45, 0.45)";
  ctx.lineWidth = Math.max(0.5, wPx / 600);
  ctx.lineCap = "round";
  const lineCount = 30 + Math.floor(rng() * 20);
  for (let i = 0; i < lineCount; i++) {
    const x1 = 0.1 + rng() * 0.8, y1 = 0.1 + rng() * 0.8;
    const angle = rng() * Math.PI * 2;
    const len = 0.04 + rng() * 0.12;
    ctx.beginPath();
    ctx.moveTo(x1 * wPx, y1 * hPx);
    ctx.lineTo((x1 + Math.cos(angle) * len) * wPx, (y1 + Math.sin(angle) * len) * hPx);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPinholes(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const count = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < count; i++) {
    const px = (0.15 + rng() * 0.7) * wPx;
    const py = (0.15 + rng() * 0.7) * hPx;
    const r = Math.max(2, wPx / 60) * (0.5 + rng() * 0.8);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, "rgba(20, 15, 10, 0.95)");
    grad.addColorStop(0.6, "rgba(40, 30, 20, 0.7)");
    grad.addColorStop(1, "rgba(80, 60, 40, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBlister(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const cx = (0.3 + rng() * 0.4) * wPx;
  const cy = (0.3 + rng() * 0.4) * hPx;
  const rx = wPx * (0.08 + rng() * 0.08);
  const ry = hPx * (0.06 + rng() * 0.06);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = rx * 0.6;
  ctx.strokeStyle = "rgba(100, 85, 75, 0.55)";
  ctx.lineWidth = Math.max(1, rx * 0.07);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const hilite = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.25, 0, cx, cy, rx);
  hilite.addColorStop(0, "rgba(255,255,255,0.38)");
  hilite.addColorStop(0.55, "rgba(255,255,255,0.12)");
  hilite.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hilite;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDrySpot(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const cx = (0.25 + rng() * 0.5) * wPx;
  const cy = (0.25 + rng() * 0.5) * hPx;
  const rx = wPx * (0.1 + rng() * 0.12);
  const ry = hPx * (0.1 + rng() * 0.1);
  ctx.fillStyle = "rgba(194, 156, 118, 0.65)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rng() * 0.5, 0, Math.PI * 2);
  ctx.fill();
  const edge = ctx.createRadialGradient(cx, cy, rx * 0.5, cx, cy, rx * 1.1);
  edge.addColorStop(0, "rgba(194,156,118,0)");
  edge.addColorStop(1, "rgba(228,225,218,0.5)");
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  const nDots = makeNoise(hashString(`dry-${cx}-${cy}`));
  ctx.fillStyle = "rgba(160,120,85,0.35)";
  for (let i = 0; i < 80; i++) {
    const ax = cx + (rng() * 2 - 1) * rx * 0.95;
    const ay = cy + (rng() * 2 - 1) * ry * 0.95;
    const stipple = 0.5 + nDots.noise(ax / 8, ay / 8) * 0.5;
    if (stipple < 0.4) continue;
    ctx.beginPath();
    ctx.arc(ax, ay, 0.6 + rng() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpecks(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const count = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const px = (0.1 + rng() * 0.8) * wPx;
    const py = (0.1 + rng() * 0.8) * hPx;
    const r = Math.max(1.5, wPx / 80) * (0.4 + rng() * 1.2);
    const dark = rng() < 0.7;
    ctx.fillStyle = dark ? `rgba(20,15,10,${0.75 + rng() * 0.2})` : `rgba(245,240,235,0.9)`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Fixed: much stronger crystalline haze visible against cream background
function drawDevitrification(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const cx = (0.25 + rng() * 0.5) * wPx;
  const cy = (0.25 + rng() * 0.5) * hPx;
  const rx = wPx * (0.18 + rng() * 0.18);
  const ry = hPx * (0.14 + rng() * 0.14);

  // Strong milky-grey crystalline haze — noticeably different from cream bg
  const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  haze.addColorStop(0, "rgba(200, 210, 220, 0.85)");
  haze.addColorStop(0.4, "rgba(205, 213, 218, 0.60)");
  haze.addColorStop(0.75, "rgba(215, 218, 220, 0.30)");
  haze.addColorStop(1, "rgba(215, 218, 220, 0)");
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rng() * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Visible iridescent crystalline needle pattern
  const needleCount = 14 + Math.floor(rng() * 10);
  for (let i = 0; i < needleCount; i++) {
    const angle = (i / needleCount) * Math.PI * 2 + rng() * 0.4;
    const r1 = (0.15 + rng() * 0.35) * rx;
    const r2 = (0.4 + rng() * 0.55) * rx;
    const iridColor = i % 3 === 0
      ? `rgba(160, 190, 215, 0.70)`
      : i % 3 === 1
        ? `rgba(200, 210, 175, 0.55)`
        : `rgba(215, 200, 225, 0.60)`;
    ctx.strokeStyle = iridColor;
    ctx.lineWidth = Math.max(1, wPx / 200) * (1 + rng() * 0.8);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1 * (ry / rx));
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2 * (ry / rx));
    ctx.stroke();
  }

  // White highlight spot at center
  const spot = ctx.createRadialGradient(cx - rx * 0.15, cy - ry * 0.15, 0, cx, cy, rx * 0.4);
  spot.addColorStop(0, "rgba(255,255,255,0.55)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.4, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Fixed: larger flakes, dramatic shadow, high-contrast lift effect
function drawFishScale(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const baseX = (0.2 + rng() * 0.2) * wPx;
  const baseY = (0.25 + rng() * 0.2) * hPx;
  const scaleCount = 2 + Math.floor(rng() * 3);

  for (let i = 0; i < scaleCount; i++) {
    const sx = baseX + (rng() - 0.5) * wPx * 0.30;
    const sy = baseY + (rng() - 0.5) * hPx * 0.25;
    const sw = wPx * (0.11 + rng() * 0.09);
    const sh = hPx * (0.10 + rng() * 0.07);

    // Deep shadow where glaze peeled from body
    ctx.fillStyle = "rgba(28, 18, 10, 0.80)";
    ctx.beginPath();
    ctx.moveTo(sx - sw * 0.05, sy + sh * 1.08);
    ctx.quadraticCurveTo(sx + sw * 0.5 + sw * 0.1, sy - sh * 0.12, sx + sw + sw * 0.05, sy + sh * 1.08);
    ctx.closePath();
    ctx.fill();

    // Lifted glaze flake — white at curled top, terracotta body at bottom
    const grad = ctx.createLinearGradient(sx, sy - sh * 0.15, sx, sy + sh);
    grad.addColorStop(0, "rgba(255, 252, 248, 0.97)");
    grad.addColorStop(0.4, "rgba(238, 232, 220, 0.92)");
    grad.addColorStop(0.8, "rgba(205, 172, 135, 0.70)");
    grad.addColorStop(1, "rgba(175, 142, 105, 0.40)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy + sh);
    ctx.quadraticCurveTo(sx + sw * 0.5, sy - sh * 0.35, sx + sw, sy + sh);
    ctx.closePath();
    ctx.fill();

    // Dark outline separating flake from background
    ctx.strokeStyle = "rgba(55, 40, 28, 0.85)";
    ctx.lineWidth = Math.max(1.2, sw * 0.055);
    ctx.beginPath();
    ctx.moveTo(sx, sy + sh);
    ctx.quadraticCurveTo(sx + sw * 0.5, sy - sh * 0.35, sx + sw, sy + sh);
    ctx.stroke();

    // Gloss highlight on curled lip
    ctx.strokeStyle = "rgba(255,255,255,0.60)";
    ctx.lineWidth = Math.max(0.8, sw * 0.025);
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.2, sy + sh * 0.5);
    ctx.quadraticCurveTo(sx + sw * 0.5, sy - sh * 0.25, sx + sw * 0.8, sy + sh * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScratch(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const angle = rng() * Math.PI * 0.5 + Math.PI * 0.1;
  const cx = (0.2 + rng() * 0.3) * wPx;
  const cy = (0.2 + rng() * 0.5) * hPx;
  const len = wPx * (0.35 + rng() * 0.45);
  ctx.strokeStyle = "rgba(155, 148, 138, 0.7)";
  ctx.lineWidth = Math.max(0.8, wPx / 400);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const mx = cx + Math.cos(angle) * len * 0.5 + (rng() - 0.5) * wPx * 0.04;
  const my = cy + Math.sin(angle) * len * 0.5;
  const ex = cx + Math.cos(angle) * len;
  const ey = cy + Math.sin(angle) * len;
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();
  if (rng() < 0.6) {
    const offset = (rng() - 0.5) * wPx * 0.015;
    ctx.strokeStyle = "rgba(155, 148, 138, 0.4)";
    ctx.beginPath();
    ctx.moveTo(cx + offset, cy + offset);
    ctx.quadraticCurveTo(mx + offset, my + offset, ex + offset, ey + offset);
    ctx.stroke();
  }
  ctx.restore();
}

// Fixed: position-aware — draws near the defect's actual x,y position
function drawChip(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  rng: () => number,
  normX?: number,
  normY?: number
) {
  ctx.save();
  // Pick the corner nearest to the defect position
  const nx = normX ?? 0.1;
  const ny = normY ?? 0.1;
  const corner = nx <= 0.5 ? (ny <= 0.5 ? 0 : 3) : (ny <= 0.5 ? 1 : 2);
  // 0=TL, 1=TR, 2=BR, 3=BL

  const size = Math.min(wPx, hPx) * (0.12 + rng() * 0.10);
  let bx: number, by: number;
  switch (corner) {
    case 0: bx = 0; by = 0; break;
    case 1: bx = wPx; by = 0; break;
    case 2: bx = wPx; by = hPx; break;
    default: bx = 0; by = hPx; break;
  }

  const baseAngle = [Math.PI, Math.PI * 1.5, 0, Math.PI * 0.5][corner];

  // Terracotta body exposed where glaze+body chipped away
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = baseAngle + (i / 6) * (Math.PI * 0.5);
    const r = size * (0.55 + rng() * 0.5);
    pts.push([bx + Math.cos(a) * r, by + Math.sin(a) * r]);
  }

  // Shadow around chip
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = size * 0.4;
  ctx.shadowOffsetX = size * 0.08 * (corner === 1 || corner === 2 ? -1 : 1);
  ctx.shadowOffsetY = size * 0.08 * (corner === 2 || corner === 3 ? -1 : 1);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Fired body fill — terracotta (much darker than glaze)
  ctx.fillStyle = "rgba(145, 105, 72, 0.98)";
  ctx.beginPath();
  ctx.moveTo(bx, by);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();

  // Fracture edge — dark sharp line
  ctx.strokeStyle = "rgba(60, 38, 22, 0.90)";
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  // Glaze cross-section highlight (thin white line along fracture)
  ctx.strokeStyle = "rgba(245, 240, 232, 0.55)";
  ctx.lineWidth = Math.max(0.8, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

// Fixed: jagged dark notches clearly visible against edge body
function drawRoughEdge(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const steps = 22 + Math.floor(rng() * 12);
  const maxDepth = hPx * 0.55;

  // Build irregular jagged profile
  const pts: [number, number][] = [[0, 0]];
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * wPx;
    const hasNotch = rng() < 0.40;
    const depth = hasNotch ? maxDepth * (0.45 + rng() * 0.55) : maxDepth * 0.10 * rng();
    pts.push([x, depth]);
  }
  pts.push([wPx, 0]);

  // Dark fill for broken/chipped region
  ctx.fillStyle = "rgba(28, 18, 10, 0.82)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();

  // Broken-clay terracotta sub-fill (shows body material)
  ctx.fillStyle = "rgba(140, 95, 58, 0.60)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (const [x, y] of pts) ctx.lineTo(x, Math.max(0, y - hPx * 0.08));
  ctx.closePath();
  ctx.fill();

  // Jagged profile stroke — white-ish fracture line
  ctx.strokeStyle = "rgba(210, 185, 155, 0.65)";
  ctx.lineWidth = Math.max(1, wPx / 250);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[1][0], pts[1][1]);
  for (let i = 2; i < pts.length - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

// Fixed: strong bow shadow making warp clearly visible
function drawWarping(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const horizontal = rng() < 0.5;

  // Heavy edge darkening — corners appear lifted
  const topShadow = ctx.createLinearGradient(0, 0, 0, hPx * 0.38);
  topShadow.addColorStop(0, "rgba(0,0,0,0.22)");
  topShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topShadow;
  ctx.fillRect(0, 0, wPx, hPx);

  const botShadow = ctx.createLinearGradient(0, hPx, 0, hPx * 0.62);
  botShadow.addColorStop(0, "rgba(0,0,0,0.22)");
  botShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = botShadow;
  ctx.fillRect(0, 0, wPx, hPx);

  // Side shadows
  const leftShadow = ctx.createLinearGradient(0, 0, wPx * 0.30, 0);
  leftShadow.addColorStop(0, "rgba(0,0,0,0.16)");
  leftShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftShadow;
  ctx.fillRect(0, 0, wPx, hPx);

  const rightShadow = ctx.createLinearGradient(wPx, 0, wPx * 0.70, 0);
  rightShadow.addColorStop(0, "rgba(0,0,0,0.16)");
  rightShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rightShadow;
  ctx.fillRect(0, 0, wPx, hPx);

  // Bright bow ridge line — the highest point of the warp curvature
  ctx.strokeStyle = "rgba(255, 252, 245, 0.42)";
  ctx.lineWidth = Math.max(2, wPx / 70);
  ctx.lineCap = "round";
  ctx.setLineDash([]);
  ctx.beginPath();
  if (horizontal) {
    ctx.moveTo(wPx * 0.06, hPx * 0.50);
    ctx.quadraticCurveTo(wPx * 0.5, hPx * 0.40, wPx * 0.94, hPx * 0.50);
  } else {
    ctx.moveTo(wPx * 0.50, hPx * 0.06);
    ctx.quadraticCurveTo(wPx * 0.40, hPx * 0.5, wPx * 0.50, hPx * 0.94);
  }
  ctx.stroke();

  // Subtle secondary shadow along the bow
  const bow = horizontal
    ? ctx.createLinearGradient(0, hPx * 0.35, 0, hPx * 0.65)
    : ctx.createLinearGradient(wPx * 0.35, 0, wPx * 0.65, 0);
  bow.addColorStop(0, "rgba(0,0,0,0.06)");
  bow.addColorStop(0.5, "rgba(0,0,0,0)");
  bow.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = bow;
  ctx.fillRect(0, 0, wPx, hPx);
  ctx.restore();
}

function drawLippage(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const yPos = (0.3 + rng() * 0.4) * hPx;
  const grad = ctx.createLinearGradient(0, yPos - 3, 0, yPos + 8);
  grad.addColorStop(0, "rgba(0,0,0,0.18)");
  grad.addColorStop(0.4, "rgba(0,0,0,0.08)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, yPos - 3, wPx, 18);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, wPx, yPos - 3);
  ctx.restore();
}

function drawColorInconsistency(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const splitX = (0.35 + rng() * 0.3) * wPx;
  const tint = ctx.createLinearGradient(splitX - wPx * 0.08, 0, splitX + wPx * 0.08, 0);
  tint.addColorStop(0, "rgba(0,0,0,0)");
  tint.addColorStop(0.5, "rgba(15,12,8,0.06)");
  tint.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = tint;
  ctx.fillRect(splitX, 0, wPx - splitX, hPx);
  const shift = ctx.createLinearGradient(splitX - 20, 0, splitX + 20, 0);
  shift.addColorStop(0, "rgba(255,248,235,0)");
  shift.addColorStop(0.5, "rgba(220,230,240,0.08)");
  shift.addColorStop(1, "rgba(255,248,235,0)");
  ctx.fillStyle = shift;
  ctx.fillRect(splitX - 20, 0, wPx, hPx);
  ctx.restore();
}

function drawPrintMisalignment(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const offset = wPx * (0.015 + rng() * 0.02);
  const lineSpacing = wPx / 8;
  ctx.strokeStyle = "rgba(80, 78, 72, 0.12)";
  ctx.lineWidth = Math.max(1, wPx / 200);
  for (let x = lineSpacing; x < wPx; x += lineSpacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hPx); ctx.stroke();
  }
  for (let y = lineSpacing; y < hPx; y += lineSpacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(wPx, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(14, 165, 233, 0.18)";
  for (let x = lineSpacing + offset; x < wPx; x += lineSpacing) {
    ctx.beginPath(); ctx.moveTo(x, offset / 2); ctx.lineTo(x, hPx + offset / 2); ctx.stroke();
  }
  for (let y = lineSpacing + offset * 0.5; y < hPx; y += lineSpacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(wPx, y); ctx.stroke();
  }
  ctx.restore();
}

// Fixed: thicker, higher-contrast smear clearly visible on cream background
function drawGlazeMark(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const sx = (0.04 + rng() * 0.12) * wPx;
  const sy = (0.2 + rng() * 0.35) * hPx;
  const ex = (0.68 + rng() * 0.28) * wPx;
  const ey = (0.25 + rng() * 0.50) * hPx;
  const mx = (sx + ex) * 0.5 + (rng() - 0.5) * wPx * 0.22;
  const my = (sy + ey) * 0.5 + (rng() - 0.5) * hPx * 0.22;
  const strokeW = wPx * (0.055 + rng() * 0.045);

  // Main mark: alternate between over-glaze (dark smear) and under-glaze (glossy lighter)
  const isDark = rng() < 0.55;
  ctx.strokeStyle = isDark
    ? `rgba(108, 98, 82, 0.82)`   // over-glazed darker streak
    : `rgba(248, 246, 242, 0.95)`; // lighter/glossy streak
  ctx.lineWidth = strokeW;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // Hard gloss highlight edge
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = strokeW * 0.20;
  ctx.beginPath();
  ctx.moveTo(sx, sy - strokeW * 0.28);
  ctx.quadraticCurveTo(mx, my - strokeW * 0.28, ex, ey - strokeW * 0.28);
  ctx.stroke();

  // Shadow edge on other side
  ctx.strokeStyle = "rgba(70, 62, 50, 0.35)";
  ctx.lineWidth = strokeW * 0.18;
  ctx.beginPath();
  ctx.moveTo(sx, sy + strokeW * 0.28);
  ctx.quadraticCurveTo(mx, my + strokeW * 0.28, ex, ey + strokeW * 0.28);
  ctx.stroke();
  ctx.restore();
}

// ── Dispatcher: paint defect overlay by type ─────────────────────────────────

function paintDefect(
  ctx: CanvasRenderingContext2D,
  defect: EditableDefect,
  surface: TileSurfaceId,
  wPx: number,
  hPx: number
) {
  const seed = hashString(`${defect.id}-${defect.type}`);
  const rng = mulberry32(seed);

  if (surface !== "face") {
    const edgeDefects = ["chip", "rough_edge", "crack", "warping", "lippage"];
    if (!edgeDefects.includes(defect.type)) return;
  }

  // Apply user rotation around defect position
  const rotDeg = defect.rotation ?? 0;
  if (rotDeg !== 0) {
    const cx = defect.x * wPx, cy = defect.y * hPx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (defect.type) {
    case "crack":              drawCrack(ctx, wPx, hPx, rng); break;
    case "crazing":            drawCrazing(ctx, wPx, hPx, rng); break;
    case "pinhole":            drawPinholes(ctx, wPx, hPx, rng); break;
    case "blister":            drawBlister(ctx, wPx, hPx, rng); break;
    case "dry_spot":           drawDrySpot(ctx, wPx, hPx, rng); break;
    case "speck":              drawSpecks(ctx, wPx, hPx, rng); break;
    case "glaze_devitrification": drawDevitrification(ctx, wPx, hPx, rng); break;
    case "fish_scale":         drawFishScale(ctx, wPx, hPx, rng); break;
    case "scratch":            drawScratch(ctx, wPx, hPx, rng); break;
    case "chip":               drawChip(ctx, wPx, hPx, rng, defect.x, defect.y); break;
    case "rough_edge":         drawRoughEdge(ctx, wPx, hPx, rng); break;
    case "warping":            drawWarping(ctx, wPx, hPx, rng); break;
    case "lippage":            drawLippage(ctx, wPx, hPx, rng); break;
    case "color_inconsistency": drawColorInconsistency(ctx, wPx, hPx, rng); break;
    case "print_misalignment": drawPrintMisalignment(ctx, wPx, hPx, rng); break;
    case "glaze_mark":         drawGlazeMark(ctx, wPx, hPx, rng); break;
  }

  if (rotDeg !== 0) {
    ctx.restore();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RenderedTileSurface {
  base64: string;
  mime: "image/jpeg";
  widthPx: number;
  heightPx: number;
}

export async function renderTileSurface(
  surface: TileSurfaceId,
  dims: TileDimensions,
  defects: EditableDefect[]
): Promise<RenderedTileSurface> {
  const size = getTileSurfaceSize(surface, dims);
  const { wPx, hPx } = pickSize(size.width_mm, size.height_mm);

  const canvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : ({ width: wPx, height: hPx } as HTMLCanvasElement);
  canvas.width = wPx;
  canvas.height = hPx;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const baseSeed = hashString(`${surface}-${dims.width_mm}-${dims.height_mm}`);
  if (surface === "face") {
    paintGlazedFace(ctx, wPx, hPx, baseSeed, dims.color);
  } else {
    paintFiredEdge(ctx, wPx, hPx, baseSeed);
  }

  const relevant = defects.filter((d) => {
    if (surface === "face") {
      return (
        d.zone === "face" ||
        d.zone.includes("corner") ||
        (surface === "face" && (d.type === "color_inconsistency" || d.type === "print_misalignment" || d.type === "glaze_mark" || d.type === "crazing" || d.type === "warping" || d.type === "lippage"))
      );
    }
    const zoneToSurface: Record<string, TileSurfaceId> = {
      top_edge: "top_edge",
      bottom_edge: "bottom_edge",
      left_edge: "left_edge",
      right_edge: "right_edge",
      top_left_corner: "top_edge",
      top_right_corner: "top_edge",
      bottom_left_corner: "bottom_edge",
      bottom_right_corner: "bottom_edge",
    };
    return zoneToSurface[d.zone] === surface;
  });

  for (const defect of relevant) {
    paintDefect(ctx, defect, surface, wPx, hPx);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mime: "image/jpeg", widthPx: wPx, heightPx: hPx };
}

export async function renderAllTileSurfaces(
  dims: TileDimensions,
  defects: EditableDefect[]
): Promise<Record<TileSurfaceId, RenderedTileSurface>> {
  const surfaces: TileSurfaceId[] = ["face", "top_edge", "bottom_edge", "left_edge", "right_edge"];
  const out = {} as Record<TileSurfaceId, RenderedTileSurface>;
  for (const s of surfaces) {
    out[s] = await renderTileSurface(s, dims, defects);
  }
  return out;
}

// ── Thumbnail for 3D editor markers ─────────────────────────────────────────

export function renderDefectThumbnailCanvas(defectType: string, size = 80): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Cream tile base
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size * 4; i += 4) {
    img.data[i] = 228; img.data[i + 1] = 225; img.data[i + 2] = 218; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const fakeDefect: EditableDefect = {
    id: `thumb-${defectType}`,
    zone: defectType === "chip" ? "top_left_corner" : "face",
    type: defectType,
    x: defectType === "chip" ? 0.12 : 0.5,
    y: defectType === "chip" ? 0.12 : 0.5,
    severity: "major",
  };
  paintDefect(ctx, fakeDefect, "face", size, size);
  return canvas;
}

// ── Single-defect example render for DefectGuide ─────────────────────────────

export async function renderDefectExample(defectType: string): Promise<RenderedTileSurface> {
  const fakeDims: TileDimensions = { width_mm: 300, height_mm: 300, thickness_mm: 10 };

  // Position defects realistically per type
  const configMap: Record<string, { zone: ZoneId; x: number; y: number; surface: TileSurfaceId }> = {
    chip:       { zone: "top_left_corner", x: 0.08, y: 0.08, surface: "face" },
    rough_edge: { zone: "top_edge",        x: 0.5,  y: 0.5,  surface: "top_edge" },
  };
  const cfg = configMap[defectType] ?? { zone: "face" as ZoneId, x: 0.5, y: 0.5, surface: "face" as TileSurfaceId };

  const fakeDefect: EditableDefect = {
    id: `example-${defectType}`,
    zone: cfg.zone,
    type: defectType,
    x: cfg.x,
    y: cfg.y,
    severity: "major",
  };

  // rough_edge examples use the edge surface so the jagged profile is clearly visible
  const edgeDims: TileDimensions = { width_mm: 300, height_mm: 60, thickness_mm: 10 };
  return renderTileSurface(
    cfg.surface,
    cfg.surface === "top_edge" ? edgeDims : fakeDims,
    [fakeDefect]
  );
}
