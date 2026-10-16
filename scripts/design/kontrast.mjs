#!/usr/bin/env node
/**
 * kontrast.mjs — Beyaz Vitrin token'larındaki metin/zemin çiftlerinin WCAG 2.x kontrastını ölçer.
 *
 * Kullanım:  node scripts/design/kontrast.mjs [--md]
 *   --md   Markdown tablosu basar (DESIGN.md §1'e yapıştırmak için)
 * Çıkış kodu: herhangi bir çift eşiğin altındaysa 1.
 * Kaynaklar: src/assets/css/tokens.css (:root) ve vitrin.css (.vitrin__slayt--* tema tonları, --_ton).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKDOWN = process.argv.includes('--md');

const tokenCss = readFileSync(resolve(KOK, 'src/assets/css/tokens.css'), 'utf8');
const vitrinCss = readFileSync(resolve(KOK, 'src/assets/css/vitrin.css'), 'utf8');

const kok = tokenCss.slice(tokenCss.indexOf(':root'), tokenCss.indexOf('}', tokenCss.indexOf(':root')));
const t = {};
for (const m of kok.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{6})\b/gi)) t[m[1]] = m[2].toLowerCase();
for (const m of vitrinCss.matchAll(/\.vitrin__slayt--(\w+)\s*\{\s*--_ton:\s*(#[0-9a-f]{6})/gi)) t[`ton-${m[1]}`] = m[2].toLowerCase();
const gerekli = ['--c-bg', '--c-band', '--c-ink', '--c-ink-2', '--c-ink-soft', '--c-fill', '--c-fill-hover', '--c-accent', '--c-accent-hover', '--c-on-accent', '--c-focus'];
const eksik = gerekli.filter((k) => !t[k]);
if (eksik.length) {
  console.error(`tokens.css içinde bulunamadı: ${eksik.join(', ')}`);
  process.exit(2);
}

/* [ön plan, zemin, kullanım, eşik, ön plan opaklığı] — eşik: 4.5 metin, 3 bileşen sınırı/odak halkası */
const CIFTLER = [
  ['--c-ink', '--c-bg', 'Gövde metni / sayfa', 4.5],
  ['--c-ink', '--c-band', 'Gövde metni / bant', 4.5],
  ['--c-ink', '--c-fill', 'Çip, ikincil düğme metni', 4.5],
  ['--c-ink', '--c-fill-hover', 'İkincil düğme üzerinde', 4.5],
  ['--c-ink-2', '--c-bg', 'İkincil metin, künye / sayfa', 4.5],
  ['--c-ink-2', '--c-band', 'İkincil metin / bant, arama yer tutucusu', 4.5],
  ['--c-ink', '--c-fill', 'Çip sayacı (%70 opak)', 4.5, 0.7],
  ['--c-ink', '--c-fill-hover', 'Çip sayacı üzerinde (%70 opak)', 4.5, 0.7],
  ['--c-on-accent', '--c-accent', 'Birincil düğme, Önizle rozeti', 4.5],
  ['--c-on-accent', '--c-accent-hover', 'Birincil düğme üzerinde', 4.5],
  ['--c-accent', '--c-bg', 'Vurgu rengi metin (geçerli menü öğesi) / sayfa', 4.5],
  ['--c-accent', '--c-band', 'Vurgu rengi metin / bant', 4.5],
  ['--c-bg', '--c-ink', 'Seçili çip, koyu düğme metni', 4.5],
  ['--c-focus', '--c-bg', 'Odak halkası / sayfa (bileşen)', 3],
  ['--c-focus', '--c-band', 'Odak halkası / bant (bileşen)', 3],
  ['--c-focus', '--c-fill', 'Odak halkası / çip, düğme (bileşen)', 3],
];
for (const ad of ['peach', 'sage', 'blue', 'cream']) {
  if (t[`ton-${ad}`]) {
    CIFTLER.push(['--c-ink', `ton-${ad}`, `Hero başlığı / ${ad} tonu`, 4.5]);
    CIFTLER.push(['--c-ink-soft', `ton-${ad}`, `Hero açıklaması / ${ad} tonu`, 4.5]);
  }
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dogrusal = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const parlaklik = ([r, g, b]) => 0.2126 * dogrusal(r) + 0.7152 * dogrusal(g) + 0.0722 * dogrusal(b);
const karistir = (on, zemin, a) => on.map((v, i) => Math.round(v * a + zemin[i] * (1 - a)));
const oran = (a, b) => {
  const [yuksek, dusuk] = [parlaklik(a), parlaklik(b)].sort((x, y) => y - x);
  return (yuksek + 0.05) / (dusuk + 0.05);
};
const seviye = (o) => (o >= 7 ? 'AAA' : o >= 4.5 ? 'AA' : o >= 3 ? 'AA bileşen/büyük' : 'BAŞARISIZ');

let basarisiz = 0;
const satirlar = CIFTLER.map(([on, zemin, kullanim, esik, alfa = 1]) => {
  const z = rgb(t[zemin]);
  const o = karistir(rgb(t[on]), z, alfa);
  const r = oran(o, z);
  const gecti = r >= esik;
  if (!gecti) basarisiz += 1;
  return { on: `${on.replace('--c-', '')}${alfa < 1 ? ` ${alfa * 100}%` : ''}`, zemin: zemin.replace('--c-', ''), hexOn: t[on], hexZemin: t[zemin], kullanim, r, esik, sev: seviye(r), gecti };
});

if (MARKDOWN) {
  console.log('| Ön plan | Zemin | Kullanım | Oran | Eşik | Seviye |\n|---|---|---|---:|---:|---|');
  for (const s of satirlar) console.log(`| \`${s.on}\` ${s.hexOn} | \`${s.zemin}\` ${s.hexZemin} | ${s.kullanim} | ${s.r.toFixed(2)}:1 | ${s.esik} | ${s.gecti ? s.sev : 'BAŞARISIZ'} |`);
} else {
  for (const s of satirlar) console.log(`${s.gecti ? 'OK ' : 'XX '} ${s.r.toFixed(2).padStart(5)}:1  (eşik ${s.esik})  ${s.on} ${s.hexOn} / ${s.zemin} ${s.hexZemin}  — ${s.kullanim}`);
}
console.log(`\n${satirlar.length} çift ölçüldü, ${basarisiz} başarısız.`);
process.exit(basarisiz ? 1 : 0);
