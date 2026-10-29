// Adds a dark theme to the stylesheets without touching the light one: every colour literal becomes
// light-dark(<original>, <dark>), where <dark> is derived in OKLCH from the colour's role (surface, text, line,
// shadow). The browser picks the side from `color-scheme`, which the theme toggle sets on <html>.
//
// Usage: node scripts/theme-dark.cjs            (rewrites src/**/*.css except landing.css)
//        node scripts/theme-dark.cjs --check    (lists what would change, writes nothing)
// Running it again is safe: values that already contain light-dark() are left alone.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const SKIP = new Set(["landing.css"]);
const check = process.argv.includes("--check");

const NAMED = { white: "#ffffff", black: "#000000" };

function parse(token) {
  const t = token.toLowerCase();
  if (NAMED[t]) return parse(NAMED[t]);
  if (t.startsWith("#")) {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0) / 255, g: n(2) / 255, b: n(4) / 255, a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = t.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a: alpha };
}

function oklch({ r, g, b }) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + Bb * Bb);
  const H = ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360;
  return { L, C, H };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Dark-theme counterpart of a colour, by the role it plays in the declaration. */
function darkOf(color, role) {
  const { L, C, H } = oklch(color);
  let l = L;
  let c = C;
  if (role === "surface") {
    const pureWhite = color.r === 1 && color.g === 1 && color.b === 1;
    if (pureWhite) {
      l = 0.225;
      c = 0.006;
    } else if (L >= 0.6) {
      l = clamp(0.185 + (1 - L) * 0.55, 0.185, 0.34);
      c = Math.min(C * 0.7, 0.07);
    }
  } else if (role === "text") {
    if (L < 0.75) {
      l = clamp(1.0 - L * 0.55, 0.6, 0.95);
      c = Math.min(C * 1.05, 0.16);
    }
  } else if (role === "line") {
    if (C < 0.06 || L > 0.85) {
      l = L > 0.6 ? clamp(0.27 + (1 - L) * 0.8, 0.27, 0.45) : clamp(1 - L * 0.7, 0.5, 0.8);
      c = Math.min(C * 0.6, 0.04);
    }
  } else if (role === "shadow") {
    if (L > 0.6) {
      l = 0.2;
      c = Math.min(C, 0.02);
    } else {
      return `oklch(0 0 0 / ${round(Math.min(color.a * 1.8, 0.6))})`;
    }
  }
  const alpha = color.a < 1 ? ` / ${round(color.a)}` : "";
  return `oklch(${round(l)} ${round(c)} ${Math.round(H)}${alpha})`;
}

const round = (v) => Math.round(v * 1000) / 1000;

function roleOf(prop) {
  const p = prop.toLowerCase();
  if (p === "--green" || p === "--ink" || p === "--muted" || /^--customer-(ink|muted)$/.test(p)) return "text";
  if (p === "--lime") return "surface";
  if (p === "--line") return "line";
  if (p.startsWith("--")) return null;
  if (p.startsWith("background") || p === "fill") return "surface";
  if (/^(color|caret-color|accent-color|-webkit-text-fill-color|text-decoration-color)$/.test(p)) return "text";
  if (/^(border|outline|column-rule|stroke)/.test(p)) return "line";
  if (/shadow|^filter$/.test(p)) return "shadow";
  return null;
}

const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;
const DECL = /((?:^|[{;]|\*\/)\s*)((?:--)?[a-zA-Z-]+)(\s*:\s*)([^;{}]+?)(\s*)(?=[;}])/g;

let changedTotal = 0;
for (const file of walk(SRC)) {
  if (!file.endsWith(".css") || SKIP.has(path.basename(file))) continue;
  const before = fs.readFileSync(file, "utf8");
  let changed = 0;
  const after = before.replace(DECL, (all, lead, prop, colon, value, trail) => {
    const role = roleOf(prop);
    if (!role || value.includes("light-dark(")) return all;
    const next = value.replace(COLOR, (token) => {
      const color = parse(token);
      if (!color) return token;
      changed++;
      return `light-dark(${token}, ${darkOf(color, role)})`;
    });
    return lead + prop + colon + next + trail;
  });
  changedTotal += changed;
  console.log(`${String(changed).padStart(4)}  ${path.relative(SRC, file)}`);
  if (!check && after !== before) fs.writeFileSync(file, after);
}
console.log(`${check ? "would convert" : "converted"} ${changedTotal} colours`);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
