/* Yönetim paneli: Kitaplık (kapak kartları) ve sade kitap formu. admin.js ana bilgisayar nesnesini (host) verir.
   CSP: satır içi stil yok; görünüm yalnız sınıflarla. */
import { pdfToCovers } from "./pdf-cover.js";
import { mockupDataUrl } from "./kitap-mockup.js";

const MAX_PDF = 120 * 1024 * 1024;
const PDF_OR_IMAGE = "image/png,image/jpeg,image/webp,application/pdf";
const thisMonth = () => new Date().toISOString().slice(0, 7);

const filterOf = { all: () => true, published: (b) => b.status !== "draft", draft: (b) => b.status === "draft" };

export function createLibrary(host) {
  const { state, list, escape, route, safeImage, heading, input, select } = host;
  let filter = "all";
  let mockupToken = 0;      // kapak değişirken eski kapağın kitap görselinin yeni karta yazılmasını önler

  const newestFirst = (a, b) => String(b.publish_date ?? "").localeCompare(String(a.publish_date ?? "")) || host.byTitle(a, b);
  const visible = () => {
    const query = state.query.toLocaleLowerCase("tr");
    return [...list("books")].sort(newestFirst).filter((b) => filterOf[filter](b) && `${b.title} ${b.author_display ?? ""} ${(b.authors ?? []).join(" ")} ${b.isbn ?? ""}`.toLocaleLowerCase("tr").includes(query));
  };

  /* ---------- Kitaplık görünümü ---------- */
  function card(book) {
    const image = safeImage(book.cover?.local_path);
    const title = host.oneLine(book.title);
    const draft = book.status === "draft";
    const initials = escape(title.split(" ").slice(0, 2).map((w) => w[0]).join(""));
    const cover = image ? `<img src="${escape(image)}" alt="" loading="lazy">` : `<span class="book-cover-empty" aria-hidden="true">${initials}</span>`;
    const badges = `${draft ? '<span class="badge badge-draft">Sitede gizli</span>' : '<span class="badge">Yayında</span>'}${host.hasPreview(book) ? '<span class="badge badge-preview">Önizleme</span>' : ""}${book.back_cover ? '<span class="badge badge-soft">Arka kapak</span>' : ""}`;
    return `<article class="book-card${draft ? " is-draft" : ""}" data-book="${escape(book.id)}">
<button type="button" class="book-cover" data-edit="${escape(book.id)}" tabindex="-1" aria-hidden="true">${cover}</button>
<div class="book-info"><h3>${escape(title)}</h3><p>${escape(book.author_display || (book.authors ?? []).join(", ") || "Yazar belirtilmemiş")}</p><div class="book-badges">${badges}</div></div>
<div class="book-actions"><button type="button" class="button button-small" data-edit="${escape(book.id)}" aria-label="${escape(title)} düzenle">Düzenle</button>
<details class="card-menu"><summary class="button button-small" aria-label="${escape(title)} için diğer işlemler">⋯</summary><div class="card-menu-list">
<button type="button" data-toggle-draft="${escape(book.id)}">${draft ? "Sitede göster" : "Sitede gizle"}</button>
${image ? `<button type="button" data-mockup="${escape(book.id)}">Kitap görselini indir</button>` : ""}
<button type="button" class="is-danger" data-delete="${escape(book.id)}">Sil…</button></div></details></div></article>`;
  }

  function grid() {
    const books = visible();
    const empty = state.query || filter !== "all" ? "Bu aramayla eşleşen kitap yok." : "Henüz kitap yok. “Yeni kitap” ile ilkini ekleyin.";
    return `<div class="book-grid"><button type="button" class="book-card book-card-new" data-add="books"><span class="plus" aria-hidden="true">+</span><strong>Yeni kitap</strong><small>Kapak resmi, açıklama, fiyat</small></button>${books.map(card).join("")}${books.length ? "" : `<p class="empty book-empty">${empty}</p>`}</div>`;
  }

  function chips() {
    const all = list("books");
    const counts = { all: all.length, published: all.filter(filterOf.published).length, draft: all.filter(filterOf.draft).length };
    return [["all", "Hepsi"], ["published", "Yayında"], ["draft", "Sitede gizli"]]
      .map(([key, label]) => `<button type="button" class="chip${filter === key ? " is-on" : ""}" data-library-filter="${key}" aria-pressed="${filter === key}">${label} <span>${counts[key]}</span></button>`).join("");
  }

  function view() {
    return `${heading("Kitaplık", "Kitaplar", "Kitapların kapaklarını görün, yenisini ekleyin, sitede gizleyin ya da silin. Değişiklikler üstteki “Yayınla” düğmesiyle internetteki siteye çıkar.")}
<div class="library-tools"><input class="search-input" data-search type="search" value="${escape(state.query)}" placeholder="Kitap ya da yazar ara…" aria-label="Kitap ara" autocomplete="off"><div class="chip-row" data-library-chips role="group" aria-label="Kitapları süz">${chips()}</div></div>
<div id="library-grid">${grid()}</div>`;
  }
  const renderGrid = () => {
    const target = document.getElementById("library-grid");
    if (target) target.innerHTML = grid();
    const row = document.querySelector("[data-library-chips]");
    if (row) row.innerHTML = chips();
  };
  const setFilter = (key) => { if (filterOf[key]) { filter = key; renderGrid(); } };

  /* ---------- Hızlı işlemler ---------- */
  async function toggleDraft(id) {
    const book = list("books").find((b) => b.id === id);
    if (!book) return;
    if (state.saving) { host.toast("Başka bir işlem sürüyor; birkaç saniye bekleyip yeniden deneyin.", "error"); return; }
    const next = book.status === "draft" ? "published" : "draft";
    host.setBusy(true);
    try {
      host.toast(next === "draft" ? "Kitap sitede gizleniyor…" : "Kitap sitede gösteriliyor…");
      await host.syncContent(await host.api(`books/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: next }) }));
      host.renderMain();
      host.toast(next === "draft" ? "Kitap gizlendi (kaydı herkese açık depoda durur). Siteye çıkarmak için “Yayınla”ya basın." : "Kitap yeniden görünür. Siteye çıkarmak için “Yayınla”ya basın.");
    } catch (error) { host.toast(error.message, "error"); }
    finally { host.setBusy(false); }
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Kapak görseli açılamadı.")); img.src = url; });
  }
  function download(name, dataUrl) {
    const link = document.createElement("a");
    link.href = dataUrl; link.download = name;
    document.body.append(link); link.click(); link.remove();
  }
  async function downloadMockup(id) {
    const book = list("books").find((b) => b.id === id);
    const url = safeImage(book?.cover?.local_path);
    if (!book || !url) return;
    try { download(`${book.id}-kitap-gorseli.png`, mockupDataUrl(await loadImage(url), { size: 1400 })); }
    catch (error) { host.toast(error.message, "error"); }
  }

  /* ---------- Kitap formu ---------- */
  function guide() {
    const sample = list("books").find((b) => b.id === "haim-nahum") ?? list("books").find((b) => (b.description ?? "").length > 150);
    const text = sample ? String(sample.description).split(/\n{2,}/)[0].slice(0, 320) : "";
    return `<details class="guide" open><summary>Açıklamaya ne yazmalı?</summary><ul>
<li><strong>Kitabın konusunu 2–3 cümleyle</strong> anlatın: ne anlatıyor, kimler için, neyi öne çıkarıyor?</li>
<li><strong>Arka kapak yazısını</strong> olduğu gibi yapıştırabilirsiniz.</li>
<li><strong>Fiyat, indirim, kargo ve telefon yazmayın.</strong> Site bunları metinden otomatik siler; fiyat için aşağıdaki kutuyu kullanın.</li>
<li><strong>En önemli cümle başta olsun:</strong> Google sonuçlarında ilk 160 karakter görünür.</li></ul>
${sample ? `<p class="guide-example"><strong>Örnek (${escape(sample.title)}):</strong> “${escape(text)}${String(sample.description).length > 320 ? "…" : ""}”</p>` : ""}</details>`;
  }

  function dropzone() {
    return `<div class="dropzone" data-dropzone tabindex="0" role="button" aria-describedby="drop-help"><div class="dropzone-body" data-dropzone-body></div></div>
<input class="visually-hidden" type="file" accept="${PDF_OR_IMAGE}" data-cover-file aria-label="Kapak resmi ya da baskı PDF'i seç" tabindex="-1">
<p class="dropzone-help" id="drop-help">Kapağın <strong>resmini</strong> (JPG/PNG) ya da yayınevinin <strong>baskı PDF'ini</strong> buraya bırakın. PDF verirseniz ön ve arka kapağı kendisi ayırır.</p>
<p class="dropzone-status" data-cover-status role="status" aria-live="polite"></p>
<div class="cover-extras" data-cover-extras></div>`;
  }

  function editorBody(item, editing) {
    const advanced = `${input("Sayfa adresi", "id", item.id ?? "", { required: true, readonly: editing, help: editing ? "Yayınlanmış kitabın adresi değiştirilemez." : "Kitap adından kendiliğinden oluşur." })}
${input("Alt başlık", "subtitle", item.subtitle, { wide: true })}
${input("Sitede görünen yazar adı", "author_display", item.author_display, { placeholder: "Örn. Prof. Dr. Ali Seyyar", help: "Boşsa yazar adı aynen görünür." })}
${input("Baskı", "edition", item.edition, { placeholder: "3. Baskı" })}
${select("Sitede görünürlük", "status", item.status || "published", [["published", "Yayında"], ["draft", "Sitede gizli (taslak)"]], { help: "Gizli kitap sitede görünmez, ancak kaydı ve kapağı herkese açık GitHub deposunda durur. Henüz duyurulmamış bir kitabı saklamak için kullanmayın." })}
${input("ISBN", "isbn", item.isbn, { maxlength: 17 })}${input("Sayfa sayısı", "pages", item.pages, { type: "number", min: 1 })}
${input("Yayın tarihi", "publish_date", item.publish_date ?? (editing ? "" : thisMonth()), { placeholder: "2026, 2026-10 veya 2026-10-14" })}${input("Boyutlar", "dimensions", item.dimensions, { placeholder: "13,5 × 21 cm" })}
${input("Kapak / cilt türü", "binding", item.binding, { placeholder: "Karton Kapak" })}${input("Dizi / seri", "series", item.series)}
<label class="checkbox-field field-wide"><input type="checkbox" name="is_set"${item.is_set ? " checked" : ""}>Set veya takım kitap</label>
${host.previewSection(item)}
<div class="field field-wide"><span class="field-label">Satış bağlantıları</span><small>Kitabın satıldığı sayfaların adresleri (https:// ile başlar). Boş bırakılanlar sitede gösterilmez.</small></div>
${input("Kitapyurdu", "source_kitapyurdu", item.sources?.kitapyurdu, { type: "url" })}${input("Küresel Kitap", "source_kureselkitap", item.sources?.kureselkitap, { type: "url" })}${input("Nobel Kitap", "source_nobelkitap", item.sources?.nobelkitap, { type: "url", wide: true })}`;
    return `<div class="book-editor"><div class="book-editor-cover">${dropzone()}</div><div class="book-editor-fields editor-grid">
${input("Kitap adı", "title", item.title, { required: true, maxlength: 300, wide: true })}
${input("Yazar", "authors", item.authors?.join(", "), { required: true, wide: true, help: "Birden fazla yazar varsa virgülle ayırın." })}
<div class="field field-wide"><label class="field-label" for="book-description">Açıklama <span class="req" aria-hidden="true">*</span></label>${guide()}<textarea id="book-description" name="description" rows="7" required>\n${escape(item.description ?? "")}</textarea><small data-char-count></small></div>
${input("Liste fiyatı (₺)", "price_list_try", item.price_list_try, { type: "number", min: 1, attrs: 'step="any" inputmode="decimal"', help: "Satış sitelerindeki etiket fiyatı. Emin değilseniz boş bırakın; fiyat sitede gösterilmez." })}
<div class="field field-wide"><span class="field-label">Kategori</span>${host.categoryField(item.categories ?? [])}</div>
<details class="more-info field-wide"><summary>Daha fazla bilgi (isteğe bağlı)</summary><div class="editor-grid more-grid">${advanced}</div></details>
</div></div>`;
  }

  function openEditor(item = {}) {
    const editing = Boolean(item.id);
    const ctx = { previewPages: (item.preview_pages ?? []).map((p) => ({ ...p })), cover: item.cover?.local_path ? { local_path: item.cover.local_path, width: item.cover.width ?? null, height: item.cover.height ?? null } : null, back: item.back_cover ? { ...item.back_cover } : null, coverChanged: false, backChanged: false };
    host.setContext(ctx);
    const form = host.openDialog({
      title: editing ? "Kitabı düzenle" : "Yeni kitap", plain: true, size: "wide", body: editorBody(item, editing),
      submit: "Kaydet ve yayınla", secondary: { label: editing ? "Sadece kaydet" : "Taslak olarak kaydet", intent: editing ? "save" : "draft" },
      onSubmit: (f, data, intent) => submit(f, data, item, editing, ctx, intent),
    });
    wire(form, ctx, item, editing);
    return form;
  }

  function paintCover(form, ctx, item) {
    const body = form.querySelector("[data-dropzone-body]");
    const url = ctx.cover ? safeImage(ctx.cover.local_path) : "";
    body.innerHTML = url ? `<img class="dropzone-image" src="${escape(url)}" alt="Seçilen ön kapak"><span class="dropzone-change">Değiştirmek için tıklayın ya da yeni dosya bırakın</span>` : `<span class="dropzone-icon" aria-hidden="true">⬆</span><strong>Kapağı buraya bırakın</strong><span>ya da tıklayıp seçin</span>`;
    const extras = form.querySelector("[data-cover-extras]");
    const back = ctx.back ? safeImage(ctx.back.local_path) : "";
    extras.innerHTML = `${back ? `<div class="extra-card"><img src="${escape(back)}" alt="Arka kapak"><div><strong>Arka kapak</strong><button type="button" class="link-button" data-back-remove>Kaldır</button></div></div>` : ""}${url ? '<div class="extra-card" data-mockup-card><span class="muted">Kitap görseli hazırlanıyor…</span></div>' : ""}`;
    if (url) {
      const token = ++mockupToken;
      loadImage(url).then((img) => {
        const card = extras.querySelector("[data-mockup-card]");
        if (!card || token !== mockupToken) return;
        const data = mockupDataUrl(img, { size: 1400 });
        const slugName = form.elements.namedItem("id")?.value || item.id || "kitap";
        card.innerHTML = `<img src="${data}" alt="Kitap şeklinde paylaşım görseli"><div><strong>Kitap görseli</strong><small>Sosyal medya ve WhatsApp için hazır.</small><a class="button button-small" href="${data}" download="${escape(slugName)}-kitap-gorseli.png">İndir (PNG)</a></div>`;
      }).catch(() => { extras.querySelector("[data-mockup-card]")?.remove(); });
    }
  }

  async function handleFile(form, ctx, item, file) {
    const status = form.querySelector("[data-cover-status]");
    host.clearError(form);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { host.showError(form, "Yalnızca JPG, PNG, WebP resmi ya da PDF yüklenebilir."); return; }
    if (isPdf && file.size > MAX_PDF) { host.showError(form, "PDF 120 MB'dan büyük olmamalı."); return; }
    if (!isPdf) { const problem = host.imageProblem(file); if (problem) { host.showError(form, problem); return; } }
    await host.guarded(form, isPdf ? "PDF işleniyor…" : "Kapak yükleniyor…", async () => {
      try {
        if (isPdf) {
          const result = await pdfToCovers(file, { libBase: route("yonetim-lib/pdfjs/"), onStatus: (text) => { status.textContent = text; host.setBusyText(text); } });
          if (!result.ok) { host.showError(form, result.message); return; }
          status.textContent = "Kapaklar yükleniyor…"; host.setBusyText("Kapaklar yükleniyor…");
          const front = await host.uploadBase64("on.jpg", result.front.dataUrl.split(",")[1], "cover");
          const back = await host.uploadBase64("arka.jpg", result.back.dataUrl.split(",")[1], "back");
          ctx.cover = { local_path: front.local_path, width: front.width, height: front.height };
          ctx.back = { local_path: back.local_path, webp_path: back.webp_path ?? null, width: back.width, height: back.height };
          ctx.coverChanged = ctx.backChanged = true;
          status.textContent = `Ön ve arka kapak hazır${result.spineCm ? ` (sırt ${String(result.spineCm).replace(".", ",")} cm)` : ""}. Doğru görünüyor mu? Değilse kapağı resim olarak yükleyin.`;
        } else {
          const result = await host.uploadFile(file, "cover");
          ctx.cover = { local_path: result.local_path, width: result.width, height: result.height };
          ctx.coverChanged = true;
          status.textContent = "Kapak yüklendi.";
        }
        host.markDirty(form);
        paintCover(form, ctx, item);
      } catch (error) { host.showError(form, error.message); status.textContent = ""; }
    });
  }

  function wire(form, ctx, item, editing) {
    paintCover(form, ctx, item);
    host.updateCharCount(form);
    const zone = form.querySelector("[data-dropzone]");
    const file = form.querySelector("[data-cover-file]");
    const pick = (f) => { if (f) handleFile(form, ctx, item, f); };
    zone.addEventListener("click", () => file.click());
    zone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); file.click(); } });
    file.addEventListener("change", () => { pick(file.files?.[0]); file.value = ""; });
    for (const type of ["dragenter", "dragover"]) zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-over"); });
    for (const type of ["dragleave", "drop"]) zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-over"); });
    zone.addEventListener("drop", (event) => pick(event.dataTransfer?.files?.[0]));
    form.querySelector("[data-cover-extras]").addEventListener("click", (event) => {
      if (!event.target.closest("[data-back-remove]")) return;
      ctx.back = null; ctx.backChanged = true; host.markDirty(form); paintCover(form, ctx, item);
    });
    if (!editing) {
      const title = form.elements.namedItem("title"); const id = form.elements.namedItem("id"); let custom = false;
      id.addEventListener("input", () => { custom = Boolean(id.value); });
      title.addEventListener("input", () => { if (!custom) id.value = host.slug(title.value); });
    }
    form.querySelectorAll("[data-checklist]").forEach(host.refreshChecklist);
    host.renderPreviewList();
  }

  function buildBody(item, data, ctx, status) {
    const value = (name) => String(data.get(name) ?? "").replace(/\r\n?/g, "\n").trim();
    const { onizleme_var: _readOnly, ...rest } = item;
    const authors = host.split(value("authors"));
    const body = {
      ...rest, id: value("id"), title: value("title"), subtitle: value("subtitle") || null, authors, author_display: value("author_display") || authors.join(", ") || null,
      edition: value("edition") || null, isbn: value("isbn") || null, pages: value("pages") ? Number(value("pages")) : null, price_list_try: host.numberOrNull(value("price_list_try")),
      publish_date: value("publish_date") || null, categories: host.chosenCategories(item, data), description: value("description"), status,
      dimensions: value("dimensions") || null, binding: value("binding") || null, series: value("series") || null, is_set: data.has("is_set"),
      cover: ctx.coverChanged ? { local_path: ctx.cover?.local_path ?? null, width: ctx.cover?.width ?? null, height: ctx.cover?.height ?? null, source_url: null, source: "yayinevi" } : { ...item.cover },
      sources: { ...item.sources, kitapyurdu: value("source_kitapyurdu") || null, kureselkitap: value("source_kureselkitap") || null, nobelkitap: value("source_nobelkitap") || null },
    };
    if (ctx.backChanged) body.back_cover = ctx.back ? { local_path: ctx.back.local_path, webp_path: ctx.back.webp_path ?? null, width: ctx.back.width ?? null, height: ctx.back.height ?? null } : null;
    if (ctx.previewPages.length || Array.isArray(item.preview_pages)) body.preview_pages = ctx.previewPages.map(({ local_path, width, height }) => ({ local_path, width, height }));
    return body;
  }

  async function submit(form, data, item, editing, ctx, intent) {
    const publish = intent === "publish";
    if (publish && !ctx.cover) { host.showError(form, "Yayınlamak için bir kapak resmi gerekli. Kapağı yukarıdaki kutuya bırakın ya da “Taslak olarak kaydet”i kullanın."); return; }
    const status = publish ? "published" : intent === "draft" ? "draft" : String(data.get("status") || item.status || "published");
    await host.guarded(form, host.BUILD_MESSAGE, async () => {
      host.clearError(form);
      try {
        const body = buildBody(item, data, ctx, status);
        const result = await host.api(`books${editing ? `/${encodeURIComponent(item.id)}` : ""}`, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) });
        await host.syncContent(result);
        form.dataset.dirty = "false";
        host.closeDialog();
        state.tab = "books";
        filter = "all"; state.query = "";     // kaydedilen kitap süzgeç/arama yüzünden listeden kaybolmasın
        host.renderMain();
        host.focusTitle();
        host.toast(publish ? "Kitap kaydedildi. Siteye çıkarılıyor…" : "Kitap kaydedildi. Siteye çıkarmak için “Yayınla”ya basın.");
      } catch (error) { host.showError(form, error.message); return; }
      if (publish) host.publish.start();
    });
  }

  return { view, renderGrid, setFilter, openEditor, toggleDraft, downloadMockup };
}
