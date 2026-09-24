// Generates higher-fidelity (24x24, shaded) pixel-art weather icons for the
// woodland skin, replacing the flat 12x12 single-tone originals.
import { writeFileSync } from "node:fs";

const OUT = new URL("../public/skins/woodland/icons/", import.meta.url).pathname;
const SIZE = 24;

function canvas() {
  const px = new Map();
  const set = (x, y, color) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !color) return;
    px.set(`${x},${y}`, color);
  };
  return { px, set };
}

// Shades a disc with a top-left light source: outline ring, highlight
// facing the light, base mid-tone, shadow facing away.
function shadedDisc(c, cx, cy, r, tones) {
  const { outline, hi, base, shadow } = tones;
  for (let y = cy - r - 1; y <= cy + r + 1; y++) {
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r + 0.5) continue;
      if (dist > r - 0.5) { c.set(x, y, outline); continue; }
      const light = (-dx - dy) / (Math.SQRT2 * Math.max(dist, 0.001));
      c.set(x, y, light > 0.35 ? hi : light < -0.25 ? shadow : base);
    }
  }
}

function shadedRect(c, x0, y0, w, h, tones) {
  const { outline, hi, base, shadow } = tones;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      const light = (x0 + w - 1 - x) + (y0 + h - 1 - y) > w + h - 4 ? "shadow" : x - x0 + (y - y0) < 2 ? "hi" : "base";
      c.set(x, y, edge ? outline : tones[light]);
    }
  }
}

// A rounded cloud made of overlapping shaded discs plus a flat base band.
function shadedCloud(c, cx, cy, scale, tones) {
  const lobes = [
    [-9 * scale, 1 * scale, 4.5 * scale],
    [-4 * scale, -2 * scale, 6 * scale],
    [3 * scale, -1 * scale, 6.5 * scale],
    [9 * scale, 1.5 * scale, 4.5 * scale],
  ];
  for (const [dx, dy, r] of lobes) shadedDisc(c, cx + dx, cy + dy, r, tones);
  shadedRect(c, Math.round(cx - 11 * scale), Math.round(cy + 1 * scale), Math.round(22 * scale), Math.round(4 * scale), tones);
}

// A blocky zigzag bolt built from a hand-placed cell list (in a 12x12
// reference grid, doubled to 24x24), with a left-facing highlight column
// and a dark outline ring — matches the crisp look of the other icons.
function bolt(c, originX, originY, tones) {
  const cells = new Set([
    "6,6", "7,6", "5,7", "6,7", "4,8", "5,8", "6,8", "7,8",
    "6,9", "7,9", "5,10", "6,10", "4,11",
  ]);
  const base = new Set();
  for (const cell of cells) {
    const [cx, cy] = cell.split(",").map(Number);
    const x = originX + cx * 2, y = originY + cy * 2;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) base.add(`${x + dx},${y + dy}`);
  }
  for (const key of base) {
    const [x, y] = key.split(",").map(Number);
    const hasNeighbor = (dx, dy) => base.has(`${x + dx},${y + dy}`);
    const edge = !hasNeighbor(-1, 0) || !hasNeighbor(1, 0) || !hasNeighbor(0, -1) || !hasNeighbor(0, 1);
    c.set(x, y, edge ? tones.outline : (x - originX) % 2 === 0 ? tones.hi : tones.base);
  }
}

function flakeArm(c, cx, cy, angle, len, tones) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const nx = -dy, ny = dx;
  for (let t = 1; t <= len; t++) {
    const x = cx + dx * t, y = cy + dy * t;
    c.set(Math.round(x), Math.round(y), t === len ? tones.outline : tones.base);
    if (t === Math.round(len * 0.45)) {
      for (const s of [-1, 1]) {
        for (let b = 1; b <= 2; b++) {
          c.set(Math.round(x + nx * s * b), Math.round(y + ny * s * b), b === 2 ? tones.outline : tones.hi);
        }
      }
    }
  }
  c.set(Math.round(cx + dx), Math.round(cy + dy), tones.hi);
}

function snowflake(c, cx, cy, r, tones) {
  for (let i = 0; i < 6; i++) flakeArm(c, cx, cy, (Math.PI / 3) * i - Math.PI / 2, r, tones);
  c.set(cx, cy, tones.hi);
}

function rects(c) {
  const rows = new Map();
  for (const [key, color] of c.px) {
    const [x, y] = key.split(",").map(Number);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push([x, color]);
  }
  const out = [];
  for (const [y, entries] of [...rows].sort((a, b) => a[0] - b[0])) {
    entries.sort((a, b) => a[0] - b[0]);
    let run = null;
    for (const [x, color] of entries) {
      if (run && run.color === color && run.x + run.w === x) { run.w++; continue; }
      if (run) out.push(run);
      run = { x, y, w: 1, color };
    }
    if (run) out.push(run);
  }
  return out;
}

function svg(c) {
  const body = rects(c).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.color}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">${body}</svg>`;
}

const sunTones = { outline: "#8a5a12", hi: "#ffe08a", base: "#f2c14e", shadow: "#d19a2e" };
const cloudTones = { outline: "#7d8792", hi: "#ffffff", base: "#f6f2ea", shadow: "#c9d0d6" };
const cloudTonesDark = { outline: "#40485a", hi: "#7d8aa8", base: "#5e6a86", shadow: "#454f68" };
const fogTones = { outline: "#5c6570", hi: "#c3c9d1", base: "#9aa3ad", shadow: "#6b7580" };
const dropTones = { outline: "#274a68", hi: "#8fc0e8", base: "#4f8fc4", shadow: "#356792" };
const flakeTones = { outline: "#5c6570", hi: "#ffffff", base: "#e8f0f6" };
const boltTones = { outline: "#8a5a12", hi: "#ffe08a", base: "#f2c14e" };
const coldTones = { outline: "#3f7793", hi: "#e6f4fb", base: "#a9d3e6" };

function icon(name, draw) {
  const c = canvas();
  draw(c);
  writeFileSync(`${OUT}${name}.svg`, svg(c));
}

icon("sun", (c) => {
  const cx = 12, cy = 12, r = 6.5;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const dx = Math.cos(a), dy = Math.sin(a);
    const nx = -dy, ny = dx;
    for (let t = r + 2; t <= r + 5; t++) {
      const x = Math.round(cx + dx * t), y = Math.round(cy + dy * t);
      c.set(x, y, sunTones.base);
      c.set(Math.round(x + nx), Math.round(y + ny), t < r + 4 ? sunTones.hi : sunTones.outline);
    }
    c.set(Math.round(cx + dx * (r + 5.5)), Math.round(cy + dy * (r + 5.5)), sunTones.outline);
  }
  shadedDisc(c, cx, cy, r, sunTones);
});

icon("partly", (c) => {
  shadedDisc(c, 8, 7, 5, sunTones);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    if (a > Math.PI * 0.15 && a < Math.PI * 1.1) continue;
    const dx = Math.cos(a), dy = Math.sin(a);
    for (let t = 6; t <= 8; t++) c.set(Math.round(8 + dx * t), Math.round(7 + dy * t), t === 8 ? sunTones.outline : sunTones.hi);
  }
  shadedCloud(c, 14, 15, 0.85, cloudTones);
});

icon("cloud", (c) => shadedCloud(c, 12, 12, 1, cloudTones));

icon("fog", (c) => {
  const bands = [[3, 5], [4, 10], [3, 15], [4, 19]];
  for (const [x0, y] of bands) {
    for (let x = x0; x < 24 - x0; x++) {
      c.set(x, y, fogTones.base);
      c.set(x, y - 1, fogTones.hi);
      c.set(x, y + 1, fogTones.shadow);
    }
  }
});

icon("rain", (c) => {
  shadedCloud(c, 12, 8, 0.9, cloudTonesDark);
  const drops = [[6, 15], [12, 17], [18, 15], [9, 20], [15, 20]];
  for (const [x, y] of drops) {
    c.set(x, y, dropTones.hi);
    c.set(x, y + 1, dropTones.base);
    c.set(x, y + 2, dropTones.base);
    c.set(x - 1, y + 2, dropTones.shadow);
    c.set(x + 1, y + 3, dropTones.shadow);
  }
});

icon("snow", (c) => {
  shadedCloud(c, 12, 8, 0.9, cloudTonesDark);
  const flakes = [[6, 16], [12, 18], [18, 16], [9, 21], [15, 21]];
  for (const [x, y] of flakes) snowflake(c, x, y, 2, flakeTones);
});

icon("storm", (c) => {
  shadedCloud(c, 12, 8, 0.9, cloudTonesDark);
  bolt(c, 0, 0, boltTones);
});

icon("cold", (c) => snowflake(c, 12, 12, 10, coldTones));

console.log("wrote 8 woodland weather icons to", OUT);
