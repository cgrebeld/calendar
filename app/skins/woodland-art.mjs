import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../public/skins/woodland/", import.meta.url).pathname;

function hex(value) {
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

function png(canvas) {
  const { w, h, data } = canvas;
  const chunk = (type, body) => {
    const out = Buffer.alloc(8 + body.length + 4);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4);
    body.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), body])) >>> 0, 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function canvas(w, h) {
  const data = new Uint8Array(w * h * 4);
  const px = (x, y, c) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3] ?? 255;
  };
  const rect = (x, y, rw, rh, c) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) px(i, j, c); };
  const disc = (cx, cy, r, c) => { for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) px(i, j, c); };
  const poly = (points, c) => {
    const ys = points.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y + 0.5) === (y2 <= y + 0.5) || y1 === y2) continue;
        xs.push(x1 + ((y + 0.5 - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x < Math.ceil(xs[k + 1] - 0.5); x++) px(x, y, c);
    }
  };
  const tri = (cx, baseY, half, th, c, hi) => {
    for (let j = 0; j < th; j++) {
      const y = baseY - th + j;
      const hw = Math.round((j / (th - 1)) * half);
      for (let i = cx - hw; i <= cx + hw; i++) px(i, y, c);
      if (hi) px(cx - hw, y, hi);
    }
  };
  return { w, h, data, px, rect, disc, poly, tri };
}

const rng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function frame(night) {
  const p = night
    ? { outline: hex("#1d140b"), hi: hex("#8b6a3e"), wood: hex("#5a4328"), grain: hex("#4e3a22"), shade: hex("#3f2e19"), inner: hex("#2b2015"), nail: hex("#c9a86a") }
    : { outline: hex("#3a2a17"), hi: hex("#c9a86a"), wood: hex("#8b6a3e"), grain: hex("#7d5e35"), shade: hex("#6e522f"), inner: hex("#5b4327"), nail: hex("#e8d5a0") };
  const c = canvas(18, 18);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    const d = Math.min(x, y, 17 - x, 17 - y);
    if (d >= 6) continue;
    const along = y === d || 17 - y === d ? x : y;
    c.px(x, y, d === 0 ? p.outline : d === 1 ? p.hi : d <= 3 ? (along % 3 === 0 ? p.grain : p.wood) : d === 4 ? p.shade : p.inner);
  }
  for (const [cx, cy] of [[0, 0], [17, 0], [0, 17], [17, 17]]) {
    const nx = cx + (cx === 0 ? 2 : -2), ny = cy + (cy === 0 ? 2 : -2);
    const sx = cx + (cx === 0 ? 3 : -3), sy = cy + (cy === 0 ? 3 : -3);
    c.px(sx, sy, p.outline);
    c.px(nx, ny, p.nail);
  }
  return c;
}

function scene(night) {
  const c = canvas(480, 270);
  const stars = night && Array.from({ length: 3 }, () => canvas(480, 270));
  const clouds = canvas(480, 270);
  const reflections = Array.from({ length: 3 }, () => canvas(480, 270));
  const r = rng(night ? 2 : 1);
  const pick = (a, b) => night ? b : a;
  const sky = pick(
    ["#7fb7d9", "#93c4e0", "#a9d3e6", "#c2dde6", "#dbe3d9", "#ead9b6"],
    ["#0b1020", "#101830", "#16203d", "#1d2748", "#262e52", "#3b2f3a"],
  ).map(hex);
  for (let y = 0; y < 150; y++) c.rect(0, y, 480, 1, sky[Math.min(5, Math.floor(y / 25))]);
  const skyAt = (y) => sky[Math.min(5, Math.floor(y / 25))];

  if (night) {
    c.disc(410, 38, 12, hex("#f3ecd2"));
    for (let y = 23; y <= 45; y++) for (let x = 405; x <= 427; x++) if ((x - 416) ** 2 + (y - 34) ** 2 <= 121) c.px(x, y, skyAt(y));
    for (let i = 0; i < 140; i++) {
      const x = Math.floor(r() * 480), y = Math.floor(r() * 140);
      const col = r() < 0.3 ? hex("#b9b3a0") : hex("#fff8e0");
      const starCanvas = stars[i % stars.length];
      if (i % 10 === 0) { starCanvas.px(x, y, col); starCanvas.px(x - 1, y, col); starCanvas.px(x + 1, y, col); starCanvas.px(x, y - 1, col); starCanvas.px(x, y + 1, col); }
      else starCanvas.px(x, y, col);
    }
  } else {
    const sun = hex("#fff1b8");
    c.disc(64, 42, 14, sun);
    c.disc(64, 42, 10, hex("#ffe27a"));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]])
      for (let t = 17; t <= 20; t++) c.px(64 + Math.round(dx * t * (Math.abs(dx) + Math.abs(dy) === 2 ? Math.SQRT1_2 : 1)), 42 + Math.round(dy * t * (Math.abs(dx) + Math.abs(dy) === 2 ? Math.SQRT1_2 : 1)), sun);
  }

  const cloudBody = hex(pick("#f6f2ea", "#39405a")), cloudBand = hex(pick("#c9d0d6", "#2a3048"));
  const cloudCanvas = clouds;
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(r() * 471), y = 18 + Math.floor(r() * 78);
    const r1 = 6 + Math.floor(r() * 5), r2 = 6 + Math.floor(r() * 5), r3 = 6 + Math.floor(r() * 5);
    cloudCanvas.disc(x, y, r1, cloudBody); cloudCanvas.disc(x + 9, y - 3, r2, cloudBody); cloudCanvas.disc(x + 18, y, r3, cloudBody);
    cloudCanvas.rect(x - r1, y, 18 + r1 + r3, 4, cloudBody);
    cloudCanvas.rect(x - r1, y + 3, 18 + r1 + r3, 1, cloudBand);
  }

  const peaks = [30, 110, 190, 275, 350, 430].map((x) => [x, 118 + Math.floor(r() * 18)]);
  const ridge = [[0, 150]];
  let prev = 0;
  for (const [px_, py] of peaks) { ridge.push([(prev + px_) / 2, 150], [px_, py]); prev = px_; }
  ridge.push([(prev + 480) / 2 + 15, 150], [480, 150], [480, 176], [0, 176]);
  c.poly(ridge, hex(pick("#8fa4b8", "#1b2440")));
  for (const [px_, py] of peaks) c.poly([[px_ - 4, py + 6], [px_, py], [px_ + 4, py + 6]], hex(pick("#eef3f6", "#8e97ad")));

  const hillY = (x) => Math.round(168 + 8 * Math.sin(x / 55));
  const hill2Y = (x) => Math.round(182 + 6 * Math.sin(x / 40 + 2));
  for (let x = 0; x < 480; x++) { c.rect(x, hillY(x), 1, 270 - hillY(x), hex(pick("#8fae6b", "#1f2a1c"))); }
  for (let x = 0; x < 480; x++) { c.rect(x, hill2Y(x), 1, 270 - hill2Y(x), hex(pick("#6e9a5a", "#172014"))); }

  const pineFill = hex(pick("#3f6332", "#142216")), pineHi = hex(pick("#5f8a4f", "#1f3320")), trunk = hex("#5b4327");
  for (let i = 0; i < 26; i++) {
    const u = r();
    const x = Math.floor(u < 0.4 ? r() * 70 : u < 0.8 ? 410 + r() * 70 : r() * 480);
    const yb = hillY(x) + 2;
    c.rect(x, yb - 5, 2, 5, trunk);
    c.tri(x + 1, yb - 4, 4, 6, pineFill, pineHi);
    c.tri(x + 1, yb - 9, 3, 5, pineFill, pineHi);
    c.tri(x + 1, yb - 13, 2, 4, pineFill, pineHi);
  }

  if (night) { c.disc(402, 192, 9, hex("#5a4a2a")); c.disc(416, 192, 9, hex("#5a4a2a")); }
  const wall = hex(pick("#e8d5a0", "#8a7a5c"));
  c.rect(396, 186, 26, 14, wall);
  c.poly([[409, 178], [394, 186], [428, 186]], hex(pick("#c0503a", "#5a2f26")));
  c.rect(408, 178, 3, 1, hex("#8b3a2a"));
  c.rect(418, 177, 3, 6, hex("#6e522f"));
  if (!night) { c.px(419, 176, hex("#c9d0d6")); c.px(420, 174, hex("#c9d0d6")); c.px(419, 172, hex("#c9d0d6")); }
  c.rect(406, 192, 5, 8, hex("#5b4327"));
  const win = hex(pick("#7fb7d9", "#ffd45a")), cross = hex("#c9a86a");
  for (const wx of [400, 414]) {
    c.rect(wx, 190, 4, 4, win);
    c.rect(wx + 2, 190, 1, 4, cross); c.rect(wx, 192, 4, 1, cross);
  }

  c.rect(0, 212, 480, 1, hex(pick("#d9c7a3", "#3a3022")));
  c.rect(0, 200, 480, 12, hex(pick("#6e9a5a", "#1a2618")));
  const tuft = hex(pick("#8fae6b", "#26361f"));
  for (let i = 0; i < 90; i++) c.px(Math.floor(r() * 480), 201 + Math.floor(r() * 11), tuft);

  c.rect(0, 213, 480, 57, hex(pick("#5b8fb8", "#0f1a2e")));
  const ripple = hex(pick("#7fb7d9", "#22345a"));
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(r() * 470), y = 215 + Math.floor(r() * 53), len = 6 + Math.floor(r() * 9);
    reflections[i % reflections.length].rect(x, y, len, 1, ripple);
  }
  if (night) {
    const mr = hex("#8e97ad");
    for (let i = 0; i < 18; i++) reflections[i % reflections.length].rect(402 + Math.floor(r() * 17), 214 + Math.floor(r() * 39), 2 + Math.floor(r() * 4), 1, mr);
  }
  const reed = hex(pick("#6e9a5a", "#1f3320"));
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(r() * 480), y = 205 + Math.floor(r() * 10);
    c.rect(x, y - 3, 1, 4, reed); c.px(x, y - 4, reed);
  }
  return { base: c, stars, clouds, reflections };
}

mkdirSync(OUT, { recursive: true });
const day = scene(false), night = scene(true);
const files = [["frame.png", frame(false)], ["frame-night.png", frame(true)], ["day.png", day.base], ["night.png", night.base], ["night-clouds.png", night.clouds],
  ["day-clouds.png", day.clouds], ...day.reflections.map((c, i) => [`day-reflections${i || ""}.png`, c]),
  ...night.stars.map((c, i) => [`night-stars${i || ""}.png`, c]), ...night.reflections.map((c, i) => [`night-reflections${i || ""}.png`, c])];
for (const [name, c] of files) {
  const buf = png(c);
  writeFileSync(OUT + name, buf);
  let transparent = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i] < 255) transparent++;
  console.log(name, buf.length, "bytes,", transparent, "transparent px");
}
