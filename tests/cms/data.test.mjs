import test from "node:test";
import assert from "node:assert/strict";
import { publishedBooks, resolveAuthors, resolveVitrin, resolveCampaigns } from "../../scripts/cms/resolvers.mjs";
import { createValidators, safeUrl } from "../../scripts/cms/content.mjs";
import { readFile } from "node:fs/promises";

const visible = { id: "yayinda", title: "Yayında", authors: ["Yazar"], yazar_sluglari: ["yazar"], url: "/kitap/yayinda/", publish_date: "2026", onizleme: {} };
const draft = { ...visible, id: "taslak", status: "draft" };

test("taslak kitaplar tüm ziyaretçi veri akışından çıkar, eski kayıtlar görünür", () => {
  assert.deepEqual(publishedBooks([visible, draft]), [visible]);
  const authors = resolveAuthors([{ name: "Yazar", slug: "yazar", book_ids: ["yayinda", "taslak"], photo_url: "public/uploads/yazar.png" }, { name: "Gizli Yazar", status: "draft" }], publishedBooks([visible, draft]));
  assert.equal(authors.length, 1);
  assert.equal(authors[0].kitap_sayisi, 1);
  assert.equal(authors[0].photo_url, "/uploads/yazar.png");
  const showcase = resolveVitrin({ one_cikan: "taslak", onizleme_vitrini: ["taslak", "yayinda", "silinen"] }, publishedBooks([visible, draft]), authors);
  assert.equal(showcase.one_cikan.id, "yayinda");
  assert.deepEqual(showcase.onizlemeli, [visible]);
  assert.equal(resolveVitrin({}, [], []).one_cikan, null);
});

test("duyurular görünürlük, sıra, kitap durumu ve güvenli URL ile çözülür", () => {
  const campaigns = resolveCampaigns([
    { id: "ikinci", title: "İkinci", book_id: "yayinda", order: 2 },
    { id: "ilk", title: "İlk", link_url: "/kitaplar/", image_url: "public/uploads/banner.webp", order: 1, theme: "sage" },
    { id: "pasif", active: false },
    { id: "taslak", book_id: "taslak" },
    { id: "silinen", book_id: "silinen" },
  ], [visible]);
  assert.deepEqual(campaigns.map((c) => c.id), ["ilk", "ikinci"]);
  assert.equal(campaigns[0].image_url, "/uploads/banner.webp");
  assert.equal(campaigns[0].theme, "sage");
  assert.equal(campaigns[1].url, visible.url);
  assert.equal(campaigns[1].book, visible);
  assert.equal(resolveCampaigns([{ title: "Katalog" }], [])[0].url, "/kitaplar/");
});

test("liste fiyatı: boş gösterilmez demektir, geçerli sayı korunur, saçma değer reddedilir (ADR-018)", async () => {
  const validator = createValidators(JSON.parse(await readFile(new URL("../../data/catalog/books.schema.json", import.meta.url), "utf8")));
  assert.equal(validator.books({ title: "Kitap", price_list_try: 250 }).price_list_try, 250);
  assert.equal(validator.books({ title: "Kitap", price_list_try: 12.5 }).price_list_try, 12.5);
  assert.equal(validator.books({ title: "Kitap", price_list_try: null }).price_list_try, null);
  assert.equal(validator.books({ title: "Kitap", price_list_try: "" }).price_list_try, null);
  assert.equal(validator.books({ title: "Kitap", price_list_try: 300 }, { price_list_try: 250 }).price_list_try, 300);
  assert.equal(validator.books({ title: "Yeni ad" }, { price_list_try: 250 }).price_list_try, 250);   // fiyat verilmezse korunur
  for (const bad of [0, -5, 100001, "250", "abc", NaN, Infinity, 1.234]) assert.throws(() => validator.books({ title: "Kitap", price_list_try: bad }), /fiyat/i, String(bad));
});

test("doğrulama yanlış türleri ve şablonlara girebilecek güvensiz adresleri reddeder", async () => {
  const validator = createValidators(JSON.parse(await readFile(new URL("../../data/catalog/books.schema.json", import.meta.url), "utf8")));
  for (const value of ["javascript:alert(1)", "//evil.example", "/%2f/evil.example", "/../private", "/bad\\path", "https://user:password@example.com", "http://example.com", "https://example.com/a b"]) assert.throws(() => safeUrl(value));
  assert.equal(safeUrl("https://example.com/book"), "https://example.com/book");
  assert.equal(safeUrl(null), null);
  assert.throws(() => validator.books({ title: "Kitap", authors: "Yazar" }));
  assert.throws(() => validator.books({ title: "Kitap", status: "private" }));
  assert.throws(() => validator.books({ title: "Kitap", cover: { local_path: "../../private" } }));
  assert.throws(() => validator.authors({ name: "Yazar", book_ids: "id" }));
  assert.throws(() => validator.campaigns({ title: "Duyuru", order: 1.5 }));
  assert.throws(() => validator.campaigns({ title: "Duyuru", active: "yes" }));
  assert.throws(() => validator.campaigns({ title: "Duyuru", theme: "unknown" }));
});
