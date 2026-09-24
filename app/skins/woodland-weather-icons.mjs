// Woodland weather sprites: 24 x 24 pixels, shared palette and silhouettes.
import { writeFileSync } from "node:fs";

const OUT = new URL("../public/skins/woodland/icons/", import.meta.url);
const SIZE = 24;
const P = {
  sunEdge: "#80501e", sunHi: "#fff0a6", sun: "#f7c85d", sunShade: "#d89236",
  cloudEdge: "#52616b", cloudHi: "#ffffff", cloud: "#f0f1e8", cloudShade: "#b9c6c7",
  stormEdge: "#303e51", stormHi: "#9aaac4", storm: "#71829d", stormShade: "#4c5d78",
  blueEdge: "#244d69", blueHi: "#a8dcf1", blue: "#5aa8d6",
  frostEdge: "#427189", frostHi: "#ffffff", frost: "#a9d9e8",
  fogEdge: "#647681", fogHi: "#dce3dc", fog: "#aabbb9",
};

function canvas() {
  const px = new Map();
  const set = (x, y, color) => {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) px.set(`${x},${y}`, color);
  };
  const rect = (x, y, w, h, color) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, color);
  };
  return { px, set, rect };
}

function silhouette(c, rows, x0, y0, tones) {
  const cells = new Set();
  rows.forEach((spans, y) => spans.forEach(([a, b]) => {
    for (let x = a; x <= b; x++) cells.add(`${x0 + x},${y0 + y}`);
  }));
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !cells.has(`${x + dx},${y + dy}`));
    c.set(x, y, edge ? tones.edge : y - y0 < rows.length * .45 && x - x0 < 17 ? tones.hi : y - y0 > rows.length * .72 ? tones.shade : tones.base);
  }
}

const cloudRows = [
  [[6, 10], [15, 17]], [[5, 12], [13, 19]], [[4, 20]], [[3, 21]],
  [[1, 22]], [[0, 23]], [[0, 23]], [[0, 23]], [[0, 23]],
  [[1, 22]], [[2, 21]], [[4, 19]],
];
const whiteCloud = { edge: P.cloudEdge, hi: P.cloudHi, base: P.cloud, shade: P.cloudShade };
const darkCloud = { edge: P.stormEdge, hi: P.stormHi, base: P.storm, shade: P.stormShade };
function cloud(c, y, tones) { silhouette(c, cloudRows, 0, y, tones); }

function sun(c, cx = 12, cy = 12, small = false) {
  const rows = small
    ? [[[3, 5]], [[2, 6]], [[1, 7]], [[1, 7]], [[0, 8]], [[1, 7]], [[1, 7]], [[2, 6]], [[3, 5]]]
    : [[[4, 8]], [[2, 10]], [[1, 11]], [[1, 11]], [[0, 12]], [[0, 12]], [[0, 12]], [[1, 11]], [[1, 11]], [[2, 10]], [[4, 8]]];
  const r = small ? 4 : 6;
  const rays = small
    ? [[0, -7], [-6, -6], [6, -6], [-7, 0], [7, 0], [-6, 6], [6, 6]]
    : [[0, -10], [-8, -8], [8, -8], [-10, 0], [10, 0], [-8, 8], [8, 8], [0, 10]];
  for (const [dx, dy] of rays) {
    const horizontal = dy === 0;
    c.rect(cx + dx - (horizontal ? 1 : 0), cy + dy - (horizontal ? 0 : 1), horizontal ? 3 : 2, horizontal ? 2 : 3, P.sunEdge);
    c.set(cx + dx, cy + dy, P.sun);
  }
  silhouette(c, rows, cx - r, cy - r + (small ? 0 : 1), { edge: P.sunEdge, hi: P.sunHi, base: P.sun, shade: P.sunShade });
}

function rain(c) {
  for (const [x, y] of [[5, 15], [12, 16], [19, 15], [8, 20], [16, 20]]) {
    c.rect(x, y, 2, 2, P.blueEdge);
    c.set(x, y, P.blueHi);
    c.rect(x - 1, y + 2, 2, 2, P.blue);
    c.set(x - 1, y + 3, P.blueEdge);
  }
}

function tinyFlake(c, x, y) {
  c.set(x, y, P.frostHi);
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) c.set(x + dx, y + dy, P.frostEdge);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) c.set(x + dx, y + dy, P.frost);
}

function snow(c) {
  for (const [x, y] of [[5, 16], [12, 18], [19, 16], [7, 22], [17, 22]]) tinyFlake(c, x, y);
}

function storm(c) {
  // A two-step zigzag keeps the lightning legible at small display sizes.
  const rows = [
    [[12, 15]], [[11, 14]], [[10, 13]], [[9, 12]], [[9, 15]],
    [[12, 15]], [[11, 14]], [[10, 13]], [[9, 12]], [[8, 11]],
  ];
  silhouette(c, rows, 0, 13, { edge: P.sunEdge, hi: P.sunHi, base: P.sun, shade: P.sunShade });
  c.rect(12, 13, 2, 1, P.sunHi);
}

function cold(c) {
  const cx = 12, cy = 12;
  // Three full axes with paired branches form one clear six-point snowflake.
  for (let d = -9; d <= 9; d++) {
    c.set(cx + d, cy, d === -9 || d === 9 ? P.frostEdge : P.frost);
    c.set(cx, cy + d, d === -9 || d === 9 ? P.frostEdge : P.frost);
  }
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    for (let d = 1; d <= 6; d++) c.set(cx + s * d, cy + t * d, d === 6 ? P.frostEdge : P.frost);
    for (let d = 5; d <= 7; d++) {
      c.set(cx + s * d, cy + t * 3, P.frost);
      c.set(cx + s * 3, cy + t * d, P.frost);
    }
  }
  c.rect(11, 11, 3, 3, P.frostHi);
  c.set(12, 12, P.blueHi);
}

function fog(c) {
  for (const [x, y, w] of [[4, 4, 15], [2, 9, 20], [5, 14, 16], [3, 19, 18]]) {
    c.rect(x + 1, y, w - 2, 1, P.fogHi);
    c.rect(x, y + 1, w, 1, P.fog);
    c.rect(x + 2, y + 2, w - 4, 1, P.fogEdge);
  }
}

function svg(c) {
  const rows = new Map();
  for (const [key, color] of c.px) {
    const [x, y] = key.split(",").map(Number);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push([x, color]);
  }
  const rects = [];
  for (const [y, pixels] of [...rows].sort((a, b) => a[0] - b[0])) {
    pixels.sort((a, b) => a[0] - b[0]);
    let run;
    for (const [x, color] of pixels) {
      if (run && run.color === color && run.x + run.w === x) run.w++;
      else { if (run) rects.push(run); run = { x, y, w: 1, color }; }
    }
    if (run) rects.push(run);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects.map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.color}"/>`).join("")}</svg>`;
}

const icons = {
  sun: c => sun(c),
  partly: c => { sun(c, 8, 8, true); cloud(c, 10, whiteCloud); },
  cloud: c => cloud(c, 6, whiteCloud),
  fog,
  rain: c => { cloud(c, 1, darkCloud); rain(c); },
  snow: c => { cloud(c, 1, darkCloud); snow(c); },
  storm: c => { cloud(c, 1, darkCloud); storm(c); },
  cold,
};

for (const [name, draw] of Object.entries(icons)) {
  const c = canvas();
  draw(c);
  writeFileSync(new URL(`${name}.svg`, OUT), svg(c));
}
