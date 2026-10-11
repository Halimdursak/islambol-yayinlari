#!/usr/bin/env node
/**
 * kontrast.mjs — tokens.css'teki metin/zemin çiftlerinin WCAG 2.x kontrastını ölçer.
 *
 * Kullanım:  node scripts/design/kontrast.mjs [--md] [--oklch]
 *   --md     Markdown tablosu basar (DESIGN.md §1'e yapıştırmak için)
 *   --oklch  Her renk token'ının OKLCH karşılığını da basar
 * Çıkış kodu: herhangi bir çift eşiğin altındaysa 1.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKENS_PATH = resolve(ROOT, 'src/assets/css/tokens.css');

const args = new Set(process.argv.slice(2));
const AS_MARKDOWN = args.has('--md');
const WITH_OKLCH = args.has('--oklch');

/* Ölçülecek çiftler: [ön plan, zemin, kullanım, eşik] — eşik: 4.5 metin, 3 büyük metin/bileşen sınırı */
const PAIRS = [
  ['--c-ink', '--c-paper', 'Gövde metni / sayfa', 4.5],
  ['--c-ink', '--c-paper-raised', 'Gövde metni / kart, modal', 4.5],
  ['--c-ink', '--c-paper-sunk', 'Metin / footer, filtre çubuğu', 4.5],
  ['--c-ink-soft', '--c-paper', 'İkincil metin / sayfa', 4.5],
  ['--c-ink-soft', '--c-paper-sunk', 'İkincil metin / footer', 4.5],
  ['--c-bone', '--c-paper', 'Künye, metadata / sayfa', 4.5],
  ['--c-bone', '--c-paper-raised', 'Künye / künye tablosu', 4.5],
  ['--c-bone', '--c-paper-sunk', 'Künye / footer', 4.5],
  ['--c-seal', '--c-paper', 'Bağlantı, etiket vurgusu / sayfa', 4.5],
  ['--c-seal', '--c-paper-raised', 'Bağlantı / kart', 4.5],
  ['--c-seal', '--c-paper-sunk', 'Bağlantı / footer', 4.5],
  ['--c-seal-hover', '--c-paper', 'Bağlantı üzerinde / sayfa', 4.5],
  ['--c-on-seal', '--c-seal-fill', 'Birincil düğme metni', 4.5],
  ['--c-on-seal', '--c-seal-fill-hover', 'Birincil düğme üzerinde', 4.5],
  ['--c-paper', '--c-ink', 'Ters düğme / mürekkep zemin', 4.5],
  ['--c-rule-strong', '--c-paper', 'Bileşen sınırı (form, çip)', 3],
  ['--c-seal', '--c-paper', 'Odak halkası (bileşen)', 3],
  ['--c-ink', '--c-selection', 'Seçili metin', 4.5],
];

/* ---------- CSS ayrıştırma ---------- */
function extractBlock(css, selectorRegex) {
  const match = selectorRegex.exec(css);
  if (!match) return null;
  let depth = 0;
  const start = css.indexOf('{', match.index);
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  return null;
}

function parseVars(block) {
  const vars = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) vars[m[1]] = m[2].replace(/\/\*.*?\*\//g, '').trim();
  return vars;
}

function resolveColor(vars, name, seen = new Set()) {
  const raw = vars[name];
  if (raw === undefined) throw new Error(`Token bulunamadı: ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  if (ref) {
    if (seen.has(ref[1])) throw new Error(`Döngüsel referans: ${name}`);
    seen.add(ref[1]);
    return resolveColor(vars, ref[1], seen);
  }
  if (!/^#[0-9a-f]{6}$/i.test(raw)) throw new Error(`${name} hex değil: ${raw}`);
  return raw.toUpperCase();
}

/* ---------- Renk matematiği ---------- */
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = C < 0.002 ? 0 : (Math.atan2(B, A) * 180) / Math.PI;
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${Math.round((H + 360) % 360)})`;
}

const grade = (ratio) => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA büyük/bileşen' : 'BAŞARISIZ');

/* ---------- Ana akış ---------- */
const css = readFileSync(TOKENS_PATH, 'utf8');
const lightBlock = extractBlock(css, /^:root\s*\{/m);
const darkBlock = extractBlock(css, /:root\[data-theme="dark"\]\s*\{/);
if (!lightBlock || !darkBlock) {
  console.error('tokens.css içinde :root veya :root[data-theme="dark"] bloğu bulunamadı.');
  process.exit(2);
}
const light = parseVars(lightBlock);
const themes = [
  ['Açık (kâğıt)', light],
  ['Karanlık (gece arşivi)', { ...light, ...parseVars(darkBlock) }],
];

let failures = 0;
const colorTokenCount = Object.keys(light).filter((k) => k.startsWith('--c-')).length;

for (const [themeName, vars] of themes) {
  const rows = PAIRS.map(([fg, bg, use, min]) => {
    const fgHex = resolveColor(vars, fg);
    const bgHex = resolveColor(vars, bg);
    const ratio = contrast(fgHex, bgHex);
    const ok = ratio >= min;
    if (!ok) failures += 1;
    return { fg, bg, fgHex, bgHex, use, ratio: ratio.toFixed(2), min, level: grade(ratio), ok };
  });

  if (AS_MARKDOWN) {
    console.log(`\n**${themeName}**\n`);
    console.log('| Ön plan | Zemin | Kullanım | Oran | Eşik | Seviye |');
    console.log('|---|---|---|---:|---:|---|');
    rows.forEach((r) => console.log(`| \`${r.fg}\` ${r.fgHex} | \`${r.bg}\` ${r.bgHex} | ${r.use} | ${r.ratio}:1 | ${r.min} | ${r.ok ? r.level : '**BAŞARISIZ**'} |`));
  } else {
    console.log(`\n== ${themeName} ==`);
    console.table(rows.map((r) => ({ 'ön plan': `${r.fg} ${r.fgHex}`, zemin: `${r.bg} ${r.bgHex}`, kullanım: r.use, oran: r.ratio, eşik: r.min, seviye: r.ok ? r.level : 'BAŞARISIZ' })));
  }

  if (WITH_OKLCH) {
    console.log(`\nOKLCH (${themeName})`);
    Object.keys(vars)
      .filter((k) => k.startsWith('--c-'))
      .forEach((k) => {
        try {
          const hex = resolveColor(vars, k);
          console.log(`${k.padEnd(18)} ${hex}  ${toOklch(hex)}`);
        } catch { /* rgb()/var() dışı değerler (scrim) atlanır */ }
      });
  }
}

console.log(`\n--c- token sayısı (:root): ${colorTokenCount} · ölçülen çift: ${PAIRS.length * themes.length} · başarısız: ${failures}`);
process.exit(failures ? 1 : 0);
