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
  return { w, h, data, px, rect, poly };
}

const rng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function frame(night) {
  const palette = (night
    ? ["#1c160e", "#604025", "#a17a42", "#79532e", "#614327", "#8c6437", "#402d1c", "#241b12"]
    : ["#352315", "#704526", "#c38b47", "#ab7338", "#8b552d", "#b97d3c", "#704421", "#4b301b"]).map(hex);
  const c = canvas(96, 96);
  const random = rng(37);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const depth = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
    if (depth < 8) c.px(x, y, palette[depth]);
  }
  // Long, irregular fibres keep the repeating rails from looking like checkerboards.
  for (let i = 0; i < 65; i++) {
    const along = 8 + Math.floor(random() * 79);
    const depth = 3 + Math.floor(random() * 3);
    const length = Math.min(2 + Math.floor(random() * 11), 88 - along);
    const color = palette[3 + Math.floor(random() * 3)];
    c.rect(along, depth, length, 1, color);
    c.rect(95 - depth, along, 1, length, color);
    c.rect(along, 95 - depth, length, 1, color);
    c.rect(depth, along, 1, length, color);
  }
  for (const [x, y] of [[3, 3], [90, 3], [3, 90], [90, 90]]) {
    c.rect(x, y, 3, 3, palette[0]);
    c.rect(x, y, 2, 2, palette[2]);
  }
  return c;
}

function wood(night) {
  const colors = (night
    ? ["#574027", "#5b4329", "#62492d", "#684e31", "#523b24"]
    : ["#efbf75", "#eab96e", "#f2c780", "#f5ca82", "#e6b469"]).map(hex);
  const c = canvas(128, 64);
  const random = rng(71);
  c.rect(0, 0, c.w, c.h, colors[0]);
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(random() * c.w), y = Math.floor(random() * c.h);
    const width = 10 + Math.floor(random() * 36), height = 1 + Math.floor(random() * 2);
    const color = colors[1 + Math.floor(random() * 4)];
    c.rect(x, y, width, height, color);
    c.rect(x - c.w, y, width, height, color);
    c.rect(x, y - c.h, width, height, color);
  }
  return c;
}

function vines() {
  const c = canvas(48, 48);
  const outline = hex("#233c1c"), stem = hex("#587832");
  const leaf = (x, y, right = false) => {
    const points = [[0, 3], [2, 3], [2, 1], [5, 1], [5, 0], [8, 0], [8, 4], [6, 4], [6, 6], [3, 6], [3, 7], [0, 7]];
    c.poly(points.map(([px, py]) => [x + (right ? 8 - px : px), y + py]), outline);
    c.rect(x + 2, y + 3, 4, 3, hex("#477832"));
    c.rect(x + 3, y + 2, 3, 2, hex("#83aa3f"));
    c.rect(x + (right ? 2 : 5), y + 1, 2, 2, hex("#bcc75b"));
    c.px(x + 3, y + 4, hex("#a5bc4c"));
  };
  for (const [x, y, w, h] of [[7, 10, 4, 34], [9, 7, 7, 6], [14, 6, 30, 4]]) {
    c.rect(x, y, w, h, outline);
    c.rect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2), stem);
  }
  for (const [x, y, flip] of [[0, 31, 0], [8, 36, 1], [3, 22, 0], [11, 23, 1], [0, 15, 0], [7, 10, 1], [10, 1, 0], [18, 7, 1], [23, 0, 0], [29, 6, 1], [36, 2, 0]]) leaf(x, y, Boolean(flip));
  const sprig = canvas(32, 16);
  for (let y = 0; y < sprig.h; y++) for (let x = 0; x < sprig.w; x++) {
    const i = (y * c.w + x + 14) * 4;
    sprig.px(x, y, c.data.subarray(i, i + 4));
  }
  return { corner: c, sprig };
}

function flip(c, horizontal, vertical) {
  const result = canvas(c.w, c.h);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const i = (y * c.w + x) * 4;
    result.px(horizontal ? c.w - 1 - x : x, vertical ? c.h - 1 - y : y, c.data.subarray(i, i + 4));
  }
  return result;
}

function skyLayers(night) {
  const clouds = canvas(480, 270);
  const stars = night && Array.from({ length: 3 }, () => canvas(480, 270));
  const random = rng(2);
  if (night) for (let i = 0; i < 70; i++) {
    const x = Math.floor(random() * 480), y = 2 + Math.floor(random() * 28);
    const color = hex(i % 3 ? "#a7b5d4" : "#e6e9d9");
    stars[i % 3].px(x, y, color);
    if (i % 12 === 0) {
      stars[i % 3].rect(x - 1, y, 3, 1, color);
      stars[i % 3].rect(x, y - 1, 1, 3, color);
    }
  }
  const body = hex(night ? "#566488" : "#fff1ce");
  const shade = hex(night ? "#3b476b" : "#cddbe0");
  const highlight = hex(night ? "#7182a0" : "#fff8e4");
  const silhouette = [[0, 8], [3, 8], [3, 5], [7, 5], [7, 2], [11, 2], [11, 0], [15, 0], [15, 3], [18, 3], [18, 5], [23, 5], [23, 7], [28, 7], [28, 10], [25, 10], [25, 12], [6, 12], [6, 11], [0, 11]];
  for (const [x, y] of [[4, 9], [147, 16], [202, 10], [310, 14], [386, 8], [449, 18]]) {
    clouds.poly(silhouette.map(([dx, dy]) => [x + dx, y + dy]), body);
    clouds.rect(x + 6, y + 11, 19, 1, shade);
    clouds.rect(x + 19, y + 9, 9, 1, shade);
    clouds.rect(x + 7, y + 4, 8, 2, highlight);
    clouds.rect(x + 11, y + 1, 4, 3, highlight);
    clouds.rect(x + 2, y + 8, 6, 1, highlight);
  }
  return { stars, clouds };
}

mkdirSync(OUT, { recursive: true });
const day = skyLayers(false), night = skyLayers(true), { corner: vine, sprig } = vines();
const files = [["wood.png", wood(false)], ["wood-night.png", wood(true)],
  ["vines-nw.png", vine], ["vines-ne.png", flip(vine, true, false)],
  ["vines-sw.png", flip(vine, false, true)], ["vines-se.png", flip(vine, true, true)],
  ["vines-sprig.png", sprig],
  ["frame.png", frame(false)], ["frame-night.png", frame(true)], ["night-clouds.png", night.clouds],
  ["day-clouds.png", day.clouds], ...night.stars.map((c, i) => [`night-stars${i || ""}.png`, c])];
for (const [name, c] of files) {
  const buf = png(c);
  writeFileSync(OUT + name, buf);
  let transparent = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i] < 255) transparent++;
  console.log(name, buf.length, "bytes,", transparent, "transparent px");
}
