import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, parsePage, validatePage } from "../../scripts/cms/site-content.mjs";
import { fillDeep, fillTokens, socialList } from "../../scripts/cms/tokens.mjs";

const site = { ad: "Yayın", telefon: "+90 505 980 87 35", telefon_gosterim: "0505 980 87 35", whatsapp_url: "https://wa.me/905059808735", eposta: "a@b.com", adres: "Fatih, İstanbul", sosyal: { x: "https://x.com/islambolyayin", instagram: "https://www.instagram.com/islambolyayin/", facebook: "https://www.facebook.com/p/Sayfa-1/" } };

test("telefon numarası her yazım biçiminden aynı site biçimlerine çevrilir", () => {
  const expected = { telefon: "+90 505 980 87 35", telefon_gosterim: "0505 980 87 35", whatsapp_url: "https://wa.me/905059808735" };
  for (const input of ["0505 980 87 35", "05059808735", "+90 505 980 87 35", "905059808735", "0090 505 980 8735", "(0505) 980-87-35", "505 980 87 35"]) assert.deepEqual(normalizePhone(input), expected, input);
  assert.deepEqual(normalizePhone("+44 20 7946 0958"), { telefon: "+442079460958", telefon_gosterim: "+442079460958", whatsapp_url: "https://wa.me/442079460958" });
  for (const input of ["", "   ", "12345", "0111 111 11 11", "0505 980 87 3", "0505 980 87 355", "abc", "0505 980 87 35 x", null, 5059808735]) assert.throws(() => normalizePhone(input), /Telefon|hane|geçerli/, String(input));
});

test("yer tutucular site bilgisinden dolar, bilinmeyenler ve süslü parantezler bozulmaz", () => {
  assert.equal(fillTokens("Ara: {telefon_gosterim} / {eposta} / {whatsapp_url} / {adres} / {telefon}", site), "Ara: 0505 980 87 35 / a@b.com / https://wa.me/905059808735 / Fatih, İstanbul / +90 505 980 87 35");
  assert.equal(fillTokens("{kitap_adi} ve {x} kalır", site), "{kitap_adi} ve {x} kalır");
  assert.equal(fillTokens("yer tutucu yok", site), "yer tutucu yok");
  assert.deepEqual(fillDeep({ a: ["{eposta}", { b: "{telefon_gosterim}" }], n: 3 }, site), { a: ["a@b.com", { b: "0505 980 87 35" }], n: 3 });
});

test("sosyal medya listesi yalnızca dolu bağlantıları markdown olarak yazar", () => {
  assert.equal(socialList(site), "- X: [@islambolyayin](https://x.com/islambolyayin)\n- Instagram: [@islambolyayin](https://www.instagram.com/islambolyayin/)\n- Facebook: [Yayın sayfası](https://www.facebook.com/p/Sayfa-1/)");
  assert.equal(socialList({ ...site, sosyal: { x: null, instagram: "", facebook: "https://x.com/a(b)" } }), "- Facebook: [Yayın sayfası](https://x.com/a%28b%29)");
});

test("sayfa dosyası yazımı ön bilgi sırasını ve tırnaklı sayı değerini korur", () => {
  const source = '---\ntitle: Sayfa bulunamadı\nslug: "404"\ndescription: Açıklama\nson_guncelleme: 2026-10-11\n---\n\n# Sayfa bulunamadı\n\nEski.\n';
  const { file, page } = validatePage({ title: "Yeni: başlık", description: "A\nB", body: "Yeni metin" }, source, "2026-12-31");
  assert.equal(file, '---\ntitle: Yeni: başlık\nslug: "404"\ndescription: A B\nson_guncelleme: 2026-12-31\n---\n\n# Yeni: başlık\n\nYeni metin\n');
  assert.deepEqual(parsePage(file).entries.map(([key]) => key), ["title", "slug", "description", "son_guncelleme"]);
  assert.equal(page.title, "Yeni: başlık");
  // Tırnaklı başlık ayrıştırıcıdan değişmeden geri okunur.
  const quoted = validatePage({ title: '"Tırnaklı" başlık"', description: "d", body: "m" }, source, "2026-12-31");
  assert.equal(Object.fromEntries(parsePage(quoted.file).entries).title, '"Tırnaklı" başlık"');
});
