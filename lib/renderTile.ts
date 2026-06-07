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

// Rewritten: genuine crescent-shaped lifted glaze flakes (actual fish scale appearance)
function drawFishScale(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  const clusterX = (0.25 + rng() * 0.50) * wPx;
  const clusterY = (0.25 + rng() * 0.50) * hPx;
  const count = 4 + Math.floor(rng() * 4);
  const baseR = wPx * (0.055 + rng() * 0.04);

  for (let i = 0; i < count; i++) {
    const cx = clusterX + (rng() - 0.5) * wPx * 0.42;
    const cy = clusterY + (rng() - 0.5) * hPx * 0.42;
    const r = baseR * (0.55 + rng() * 0.9);
    const rot = rng() * Math.PI * 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Exposed pit — dark ellipse showing body where glaze lifted
    ctx.fillStyle = "rgba(48, 30, 15, 0.90)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 0.52, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // The glaze flake — crescent (D-shape): outer semicircle + inner concave arc
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0, false);            // outer top arc
    ctx.arc(0, r * 0.3, r * 0.62, 0, Math.PI, true); // inner concave
    ctx.closePath();

    const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 0, 0, 0, r);
    grad.addColorStop(0,    "rgba(255, 253, 249, 0.98)");
    grad.addColorStop(0.45, "rgba(238, 230, 215, 0.92)");
    grad.addColorStop(0.80, "rgba(205, 175, 140, 0.72)");
    grad.addColorStop(1,    "rgba(175, 140, 105, 0.40)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Dark fracture outline
    ctx.strokeStyle = "rgba(48, 32, 18, 0.82)";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.stroke();

    // Gloss sheen on the lifted outer lip
    ctx.strokeStyle = "rgba(255, 255, 255, 0.60)";
    ctx.lineWidth = Math.max(0.6, r * 0.025);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    ctx.restore();
  }
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

  // Arc sweeps from corner into tile body (first quadrant per corner)
  const baseAngle = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5][corner];

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

// Rewritten: wide soft glaze application band (spray variation / curtain drip)
function drawGlazeMark(ctx: CanvasRenderingContext2D, wPx: number, hPx: number, rng: () => number) {
  ctx.save();
  const yMid = (0.22 + rng() * 0.56) * hPx;
  const bandH = hPx * (0.10 + rng() * 0.12);
  const isDark = rng() < 0.55; // true = thick/over-glazed (darker), false = thin/under-glazed (lighter)
  const blurPx = Math.max(4, Math.round(bandH * 0.30));

  // Soft-edged glaze band — blur gives realistic spray boundary
  ctx.filter = `blur(${blurPx}px)`;

  const grad = ctx.createLinearGradient(0, yMid - bandH, 0, yMid + bandH);
  if (isDark) {
    grad.addColorStop(0,    "rgba(88, 80, 66, 0)");
    grad.addColorStop(0.28, "rgba(88, 80, 66, 0.78)");
    grad.addColorStop(0.72, "rgba(88, 80, 66, 0.78)");
    grad.addColorStop(1,    "rgba(88, 80, 66, 0)");
  } else {
    grad.addColorStop(0,    "rgba(255, 253, 246, 0)");
    grad.addColorStop(0.28, "rgba(255, 253, 246, 0.82)");
    grad.addColorStop(0.72, "rgba(255, 253, 246, 0.82)");
    grad.addColorStop(1,    "rgba(255, 253, 246, 0)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, yMid - bandH, wPx, bandH * 2);

  // Unblurred gloss-sheen edge line — subtle but sharp reflectivity change
  ctx.filter = "none";
  const steps = 22 + Math.floor(rng() * 10);
  ctx.strokeStyle = isDark ? "rgba(62, 55, 44, 0.40)" : "rgba(255, 255, 255, 0.52)";
  ctx.lineWidth = Math.max(1, wPx / 220);
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * wPx;
    const y = yMid - bandH * 0.45 + (rng() - 0.5) * bandH * 0.28;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
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

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

export async function renderDefectExample(defectType: string): Promise<RenderedTileSurface> {
  if (typeof document === "undefined") {
    return { base64: "", mime: "image/jpeg", widthPx: 0, heightPx: 0 };
  }

  const seed = hashString(`example-${defectType}`);

  // ── Chip: composite face corner + edge cross-section ──────────────────────
  if (defectType === "chip") {
    const wPx = 440;
    const faceH = 340;
    const edgeH = 100;
    const divH = 2;

    const faceCanvas = makeCanvas(wPx, faceH);
    const faceCtx = faceCanvas.getContext("2d")!;
    paintGlazedFace(faceCtx, wPx, faceH, seed);
    paintDefect(faceCtx, {
      id: "chip-ex", zone: "top_left_corner", type: "chip", x: 0.08, y: 0.08, severity: "major",
    }, "face", wPx, faceH);

    // Small label on face
    faceCtx.fillStyle = "rgba(180,165,145,0.80)";
    faceCtx.font = `bold ${Math.round(wPx * 0.028)}px monospace`;
    faceCtx.fillText("FACE (front view)", Math.round(wPx * 0.03), faceH - Math.round(faceH * 0.04));

    const edgeCanvas = makeCanvas(wPx, edgeH);
    const edgeCtx = edgeCanvas.getContext("2d")!;
    paintFiredEdge(edgeCtx, wPx, edgeH, seed);
    paintDefect(edgeCtx, {
      id: "chip-ex-edge", zone: "top_left_corner", type: "chip", x: 0.08, y: 0.5, severity: "major",
    }, "top_edge", wPx, edgeH);

    edgeCtx.fillStyle = "rgba(200,175,145,0.80)";
    edgeCtx.font = `bold ${Math.round(wPx * 0.028)}px monospace`;
    edgeCtx.fillText("TOP EDGE (side view)", Math.round(wPx * 0.03), edgeH - Math.round(edgeH * 0.08));

    const out = makeCanvas(wPx, faceH + divH + edgeH);
    const ctx = out.getContext("2d")!;
    ctx.drawImage(faceCanvas, 0, 0);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, faceH, wPx, divH);
    ctx.drawImage(edgeCanvas, 0, faceH + divH);

    const b64 = out.toDataURL("image/jpeg", 0.88).split(",")[1] ?? "";
    return { base64: b64, mime: "image/jpeg", widthPx: wPx, heightPx: faceH + divH + edgeH };
  }

  // ── Rough Edge: composite face top + edge cross-section ──────────────────
  if (defectType === "rough_edge") {
    const wPx = 480;
    const faceH = 200;
    const edgeH = 120;
    const divH = 2;
    const rng = mulberry32(seed * 31);

    // Build shared jagged profile (same rng seed used for both portions)
    const steps = 26;
    const faceNotchDepth = faceH * 0.22;
    const edgeNotchDepth = edgeH * 0.72;
    const pts: { faceY: number; edgeY: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const hasNotch = rng() < 0.38;
      const t = rng();
      pts.push({
        faceY: hasNotch ? faceNotchDepth * (0.45 + t * 0.55) : faceNotchDepth * t * 0.10,
        edgeY: hasNotch ? edgeNotchDepth * (0.45 + t * 0.55) : edgeNotchDepth * t * 0.10,
      });
    }

    // Face canvas — cream tile, jagged shadow at top edge
    const faceCanvas = makeCanvas(wPx, faceH);
    const faceCtx = faceCanvas.getContext("2d")!;
    paintGlazedFace(faceCtx, wPx, faceH, seed);

    faceCtx.fillStyle = "rgba(18, 10, 5, 0.90)";
    faceCtx.beginPath();
    faceCtx.moveTo(0, 0);
    for (let i = 0; i <= steps; i++) faceCtx.lineTo((i / steps) * wPx, pts[i].faceY);
    faceCtx.lineTo(wPx, 0);
    faceCtx.closePath();
    faceCtx.fill();

    faceCtx.fillStyle = "rgba(155, 110, 65, 0.62)";
    faceCtx.beginPath();
    faceCtx.moveTo(0, 0);
    for (let i = 0; i <= steps; i++) faceCtx.lineTo((i / steps) * wPx, Math.max(0, pts[i].faceY - faceNotchDepth * 0.28));
    faceCtx.lineTo(wPx, 0);
    faceCtx.closePath();
    faceCtx.fill();

    faceCtx.strokeStyle = "rgba(215, 188, 152, 0.72)";
    faceCtx.lineWidth = Math.max(1.5, wPx / 240);
    faceCtx.lineJoin = "round";
    faceCtx.beginPath();
    faceCtx.moveTo(0, pts[0].faceY);
    for (let i = 1; i <= steps; i++) faceCtx.lineTo((i / steps) * wPx, pts[i].faceY);
    faceCtx.stroke();

    faceCtx.fillStyle = "rgba(180,165,145,0.80)";
    faceCtx.font = `bold ${Math.round(wPx * 0.028)}px monospace`;
    faceCtx.fillText("FACE (front view)", Math.round(wPx * 0.03), faceH - Math.round(faceH * 0.05));

    // Edge canvas — terracotta body, jagged top profile
    const edgeCanvas = makeCanvas(wPx, edgeH);
    const edgeCtx = edgeCanvas.getContext("2d")!;
    paintFiredEdge(edgeCtx, wPx, edgeH, seed);

    edgeCtx.fillStyle = "rgba(14, 8, 3, 0.92)";
    edgeCtx.beginPath();
    edgeCtx.moveTo(0, 0);
    for (let i = 0; i <= steps; i++) edgeCtx.lineTo((i / steps) * wPx, pts[i].edgeY);
    edgeCtx.lineTo(wPx, 0);
    edgeCtx.closePath();
    edgeCtx.fill();

    edgeCtx.fillStyle = "rgba(148, 105, 60, 0.65)";
    edgeCtx.beginPath();
    edgeCtx.moveTo(0, 0);
    for (let i = 0; i <= steps; i++) edgeCtx.lineTo((i / steps) * wPx, Math.max(0, pts[i].edgeY - edgeNotchDepth * 0.28));
    edgeCtx.lineTo(wPx, 0);
    edgeCtx.closePath();
    edgeCtx.fill();

    edgeCtx.strokeStyle = "rgba(215, 185, 148, 0.75)";
    edgeCtx.lineWidth = Math.max(1.5, wPx / 240);
    edgeCtx.lineJoin = "round";
    edgeCtx.beginPath();
    edgeCtx.moveTo(0, pts[0].edgeY);
    for (let i = 1; i <= steps; i++) edgeCtx.lineTo((i / steps) * wPx, pts[i].edgeY);
    edgeCtx.stroke();

    edgeCtx.fillStyle = "rgba(200,175,145,0.80)";
    edgeCtx.font = `bold ${Math.round(wPx * 0.028)}px monospace`;
    edgeCtx.fillText("TOP EDGE (side view)", Math.round(wPx * 0.03), edgeH - Math.round(edgeH * 0.07));

    const out = makeCanvas(wPx, faceH + divH + edgeH);
    const ctx = out.getContext("2d")!;
    ctx.drawImage(faceCanvas, 0, 0);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, faceH, wPx, divH);
    ctx.drawImage(edgeCanvas, 0, faceH + divH);

    const b64 = out.toDataURL("image/jpeg", 0.88).split(",")[1] ?? "";
    return { base64: b64, mime: "image/jpeg", widthPx: wPx, heightPx: faceH + divH + edgeH };
  }

  // ── All other defects: standard face render ───────────────────────────────
  const fakeDims: TileDimensions = { width_mm: 300, height_mm: 300, thickness_mm: 10 };
  const fakeDefect: EditableDefect = {
    id: `example-${defectType}`,
    zone: "face",
    type: defectType,
    x: 0.5,
    y: 0.5,
    severity: "major",
  };
  return renderTileSurface("face", fakeDims, [fakeDefect]);
}
