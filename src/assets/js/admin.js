/* İslambol Yayınları yönetim paneli. Tek dosya, vanilla JS.
   CSP: script-src 'self'; style-src 'self' -> satır içi stil/betik yok; görünüm yalnız sınıflarla kurulur. */
const app = document.getElementById("admin-app");
const dialog = document.getElementById("editor");
const notification = document.getElementById("notification");
const base = location.pathname.replace(/yonetim\/?$/, "");

const MAX_UPLOAD = 8 * 1024 * 1024;
const MAX_PREVIEW = 30;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUILD_MESSAGE = "Kaydediliyor ve site güncelleniyor…";

const TABS = [
  ["overview", "Genel bakış"], ["books", "Kitaplar"], ["authors", "Yazarlar"], ["campaigns", "Ana sayfa duyuruları"],
  ["vitrin", "Ana sayfa vitrini"], ["pages", "Sayfa metinleri"], ["site", "Site ayarları"],
];
const TAB_LABEL = Object.fromEntries(TABS);
const COUNTED = ["books", "authors", "campaigns", "pages"];
const singular = { books: "Kitap", authors: "Yazar", campaigns: "Duyuru" };
const SECTIONS = {
  books: ["İçerik yönetimi", "Kataloğa kitap ekleyin, bilgileri ve önizleme sayfalarını güncelleyin, yayın durumunu yönetin."],
  authors: ["İçerik yönetimi", "Yazarların portrelerini, biyografilerini ve kitaplarını düzenleyin."],
  campaigns: ["İçerik yönetimi", "Ana sayfanın üstündeki duyuruları, görselleri ve sıralamayı yönetin."],
  vitrin: ["Ana sayfa", "Ana sayfada hangi kitapların öne çıkacağını ve kaç öğe gösterileceğini seçin."],
  pages: ["Site metinleri", "Hakkımızda, İletişim gibi sayfaların yazılarını değiştirin."],
  site: ["Site ayarları", "Telefon, WhatsApp, e-posta, adres, sosyal medya ve satış noktaları."],
};

const emptyContent = () => ({ books: [], authors: [], campaigns: [], site: null, vitrin: null, pages: null, categories: [] });
const state = { csrfToken: "", content: emptyContent(), tab: "overview", query: "", saving: false };
let dialogContext = null;
let toastTimer;
let busyTimer;
let busyText = "";

/* ---------- Yardımcılar ---------- */
const $ = (selector, root = document) => root.querySelector(selector);
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (value) => String(value).toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const split = (value) => String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const route = (path) => `${base}${path.replace(/^\//, "")}`;
const oneLine = (value) => String(value ?? "").replace(/\s*\n\s*/g, " ").trim();
const numberOrNull = (value) => (value === "" || value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value));
const list = (key) => state.content[key] ?? [];
const isPublished = (book) => book.status !== "draft";
const hasPreview = (book) => Boolean(book.onizleme_var || book.preview_pages?.length);
const byTitle = (a, b) => String(a.title).localeCompare(String(b.title), "tr");
const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

function safeImage(value) {
  const candidate = String(value ?? "").replace(/^public\//, "/");
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return route(candidate);
  try { const url = new URL(candidate); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
function toast(message, kind = "ok") {
  notification.textContent = message;
  notification.dataset.kind = kind;
  notification.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { notification.hidden = true; }, kind === "error" ? 12000 : 8000);
}
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(route(`/api/admin/${path}`), { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrfToken, ...options.headers } });
  } catch { throw new Error("Yönetim sunucusuna ulaşılamadı. Yönetim penceresinin (siyah komut ekranı) açık olduğundan emin olun."); }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Bu adres yönetim sunucusuna ait değil. Yönetim penceresini (npm run cms) başlatıp oradaki adresten açın.");
  const result = await response.json();
  if (!response.ok) {
    // 401 yalnızca oturum bittiğinde girişe döndürür; "şimdiki şifre yanlış" gibi iş hatalarında oturum sürer.
    if (response.status === 401 && path !== "login" && !(await stillSignedIn())) { closeDialog(); state.csrfToken = ""; renderLogin("Oturumunuz sona erdi. Tekrar giriş yapın."); }
    throw new Error(result.error || "İşlem tamamlanamadı.");
  }
  return result;
}
async function stillSignedIn() {
  try { return Boolean((await (await fetch(route("/api/admin/session"), { credentials: "same-origin" })).json()).authenticated); }
  catch { return false; }
}
const loadContent = async () => { state.content = { ...emptyContent(), ...(await api("content")) }; };

/* ---------- Kayıt kilidi, hata ve durum satırı ---------- */
function paintStatus(form, seconds = 0) {
  const status = $("[data-status]", form);
  if (!status) return;
  status.replaceChildren();
  if (!busyText) return;
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");
  status.append(spinner, document.createTextNode(seconds >= 5 ? `${busyText} (${seconds} sn)` : busyText));
}
function lockApp(busy) {
  state.saving = busy;
  app.querySelectorAll(".nav-item, .side-link, .menu-toggle").forEach((b) => { b.disabled = busy; });
  const close = $(".close-dialog", dialog);
  if (close) close.disabled = busy;
}
function lockForm(form, busy, message = BUILD_MESSAGE) {
  clearInterval(busyTimer);
  busyText = busy ? message : "";
  $("fieldset.form-fieldset", form).disabled = busy;
  form.querySelectorAll(".form-actions button").forEach((b) => { b.disabled = busy; });
  paintStatus(form);
  if (busy) { const started = Date.now(); busyTimer = setInterval(() => paintStatus(form, Math.floor((Date.now() - started) / 1000)), 1000); }
}
async function guarded(form, message, task) {
  if (state.saving) return;
  lockApp(true);
  lockForm(form, true, message);
  try { await task(); }
  finally {
    clearInterval(busyTimer);
    busyText = "";
    lockApp(false);
    if (form.isConnected) lockForm(form, false);
  }
}
function showError(form, message) {
  const element = $("[data-form-error]", form);
  element.textContent = message;
  element.hidden = false;
  element.scrollIntoView({ block: "nearest" });
}
const clearError = (form) => { const element = $("[data-form-error]", form); if (element) element.hidden = true; };
const markDirty = (form) => { if (form) form.dataset.dirty = "true"; };

/* ---------- Giriş ekranı ---------- */
function renderLogin(error = "") {
  app.removeAttribute("aria-busy");
  app.innerHTML = `<main class="login-shell" id="main"><section class="login-intro"><a class="login-brand" href="${route("/")}">isl<span>am</span>bol <small>yayınları</small></a><p class="eyebrow">Yayınevi yönetimi</p><h1>Kitaplarınızın<br>yeni hikâyesi<br>burada başlıyor.</h1><p>Kitaplarınızı, ana sayfanızı ve site bilgilerinizi tek yerden yönetin.</p></section><section class="login-panel"><div class="login-card"><p class="eyebrow">İslambol Yayınları</p><h2>Yönetici girişi</h2><p class="muted">Sitenizi düzenlemek için giriş yapın.</p><form id="login-form"><label class="field"><span class="field-label">Yönetici şifresi</span><input name="password" data-pw aria-describedby="login-error" type="password" autocomplete="current-password" required autofocus minlength="8"></label><label class="checkbox-field"><input type="checkbox" data-show-password>Şifreyi göster</label><p class="form-error" role="alert" id="login-error" ${error ? "" : "hidden"}>${escape(error)}</p><button class="button button-primary" type="submit">Giriş yap</button></form><p class="local-note">Şifrenizi yönetim penceresinde (siyah komut ekranı) ilk açılışta gösterilen şifre olarak girin; Şifre değiştir bölümünden kendi şifrenizi belirleyebilirsiniz.</p><p class="login-return"><a href="${route("/")}">← Siteye dön</a></p></div></section></main>`;
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const button = $("button[type=submit]", form); const errorElement = $("#login-error");
    button.disabled = true; button.textContent = "Giriş yapılıyor…"; errorElement.hidden = true;
    try {
      const result = await api("login", { method: "POST", body: JSON.stringify({ password: new FormData(form).get("password") }) });
      state.csrfToken = result.csrfToken;
      await loadContent();
      renderShell();
      state.tab = "overview";
      renderMain();
      $("#page-title")?.focus({ preventScroll: true });
    } catch (loginError) { errorElement.textContent = loginError.message; errorElement.hidden = false; }
    finally { if (button.isConnected) { button.disabled = false; button.textContent = "Giriş yap"; } }
  });
}

/* ---------- Kabuk: kenar çubuğu, mobil menü, sekmeler ---------- */
function renderShell() {
  app.removeAttribute("aria-busy");
  const nav = TABS.map(([id, label]) => `<button type="button" class="nav-item" data-tab="${id}"><span>${label}</span>${COUNTED.includes(id) ? `<span class="nav-count" data-count="${id}"></span>` : ""}</button>`).join("");
  app.innerHTML = `<a class="skip-link" href="#main">Ana içeriğe geç</a><div class="admin-shell"><header class="mobile-bar"><a class="sidebar-brand" href="${route("/")}">isl<span>am</span>bol</a><span class="mobile-title" data-mobile-title></span><button type="button" class="button button-small menu-toggle" data-action="menu" aria-expanded="false" aria-controls="sidebar">Menü</button></header><aside class="sidebar" id="sidebar"><a class="sidebar-brand" href="${route("/")}">isl<span>am</span>bol</a><p class="sidebar-caption">Yayın yönetimi</p><nav aria-label="Yönetim bölümleri">${nav}</nav><div class="sidebar-bottom"><button type="button" class="side-link" data-action="password">Şifre değiştir</button><a class="side-link" href="${route("/")}" target="_blank" rel="noopener">Siteyi görüntüle ↗</a><button type="button" class="side-link" data-action="logout">Oturumu kapat</button></div></aside><main class="admin-main" id="main" tabindex="-1"></main></div>`;
}
function closeMenu() {
  $("#sidebar")?.classList.remove("is-open");
  $(".menu-toggle")?.setAttribute("aria-expanded", "false");
}
function toggleMenu() {
  const open = $("#sidebar").classList.toggle("is-open");
  $(".menu-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("#sidebar .nav-item")?.focus();
}
function updateNav() {
  app.querySelectorAll(".nav-item").forEach((b) => { if (b.dataset.tab === state.tab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  for (const key of COUNTED) { const element = $(`[data-count="${key}"]`, app); if (element) element.textContent = list(key).length; }
  const title = $("[data-mobile-title]", app);
  if (title) title.textContent = TAB_LABEL[state.tab];
}
function showTab(tab, focusField = "") {
  if (tab === state.tab && !focusField) { closeMenu(); $("#page-title")?.focus(); return; }
  const unsaved = $("#main form[data-dirty='true']");
  if (unsaved && !window.confirm("Bu sayfadaki değişiklikleri kaydetmediniz. Başka bölüme geçerseniz kaybolur. Geçilsin mi?")) return;
  state.tab = tab; state.query = "";
  closeMenu();
  renderMain();
  window.scrollTo(0, 0);
  (focusField ? $(`#main [name="${focusField}"]`) : $("#page-title"))?.focus({ preventScroll: focusField === "" });
}
function renderMain() {
  const main = $("#main");
  main.innerHTML = VIEWS[state.tab]();
  updateNav();
  updateCount();
  main.querySelectorAll("[data-checklist]").forEach(refreshChecklist);
  main.querySelectorAll("[data-wa-field]").forEach(updateWhatsapp);
  renumberChannels();
}

/* ---------- Ortak görünüm parçaları ---------- */
const heading = (eyebrow, title, text, action = "") => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1 id="page-title" tabindex="-1">${title}</h1><p class="lead">${text}</p></div>${action}</div>`;
const viewSite = `<a class="button" href="${route("/")}" target="_blank" rel="noopener">Siteyi görüntüle ↗</a>`;
const notReady = (name) => `${heading("Bölüm hazır değil", name, "Bu bölümün bilgileri yönetim sunucusundan gelmedi.")}<div class="note"><h2>Ne yapmalı?</h2><p>Yönetim penceresini (siyah komut ekranı) kapatıp <code>npm run cms</code> ile yeniden başlatın, sonra bu sayfayı yenileyin. Sorun sürerse siteyi hazırlayan kişiye bildirin.</p></div>`;

function overview() {
  const c = state.content;
  const drafts = c.books.filter((b) => !isPublished(b)).length;
  const stats = [
    ["books", "Kitap", c.books.length, `${c.books.length - drafts} yayında · ${drafts} taslak`],
    ["authors", "Yazar", c.authors.length, "Biyografiler ve kitapları"],
    ["campaigns", "Duyuru", c.campaigns.length, `${c.campaigns.filter((v) => v.active).length} aktif duyuru`],
  ];
  const shortcuts = [
    ['data-add="books"', "Kitap ekle", "Yeni bir kitabı kapağı, açıklaması ve önizleme sayfalarıyla kataloğa ekleyin."],
    ['data-add="campaigns"', "Duyuru ekle", "Ana sayfanın üstündeki tanıtım alanına yeni bir duyuru koyun."],
    ['data-tab="site" data-focus="numara"', "Telefon / WhatsApp numarasını değiştir", "Sitedeki numara ve WhatsApp bağlantısı birlikte güncellenir."],
    ['data-tab="pages"', "Sayfa metinlerini düzenle", "Hakkımızda, İletişim ve diğer sayfaların yazılarını değiştirin."],
  ];
  return `${heading("Yayınevinizin durumu", "Hoş geldiniz.", "Kitaplarınızı, ana sayfanızı ve iletişim bilgilerinizi buradan yönetirsiniz.", viewSite)}
<div class="stats">${stats.map(([tab, label, number, info]) => `<button type="button" class="stat" data-tab="${tab}"><span class="stat-label">${label}</span><span class="stat-number">${number}</span><span class="stat-info">${info}</span></button>`).join("")}</div>
<h2 class="section-title">Sık yapılan işler</h2>
<div class="shortcuts">${shortcuts.map(([attrs, title, text]) => `<button type="button" class="shortcut" ${attrs}><span class="shortcut-title">${title}</span><span class="shortcut-text">${text}</span><span class="shortcut-go" aria-hidden="true">→</span></button>`).join("")}</div>
<div class="note"><h2>Yayınlama hakkında</h2><p>Yaptığınız değişiklikler bu bilgisayardaki sitede anında görünür. İnternetteki siteyi güncellemek ayrı bir yayınlama adımıdır.</p></div>`;
}

/* ---------- Kitap, yazar, duyuru listeleri ---------- */
function collection() {
  const tab = state.tab; const [eyebrow, text] = SECTIONS[tab];
  const columns = { books: ["Kitap", "Yazar", "Durum"], authors: ["Yazar", "Kitap", "Durum"], campaigns: ["Duyuru", "Sıra", "Durum"] }[tab];
  const add = `<button type="button" class="button button-primary" data-add="${tab}">+ ${singular[tab]} ekle</button>`;
  return `${heading(eyebrow, TAB_LABEL[tab], text, add)}<div class="content-card"><div class="table-tools"><input class="search-input" data-search type="search" value="${escape(state.query)}" placeholder="${singular[tab]} ara…" aria-label="${singular[tab]} ara" autocomplete="off"><span class="table-count" data-table-count aria-live="polite"></span></div><div class="table-scroll"><table class="data-table"><caption class="visually-hidden">${TAB_LABEL[tab]} listesi</caption><thead><tr>${columns.map((c) => `<th scope="col">${c}</th>`).join("")}<th scope="col" class="align-right">İşlemler</th></tr></thead><tbody id="records">${rows()}</tbody></table></div></div>`;
}
function filteredRecords() {
  const query = state.query.toLocaleLowerCase("tr");
  return list(state.tab).filter((item) => `${item.title ?? item.display ?? item.name} ${item.author_display ?? ""} ${item.isbn ?? ""}`.toLocaleLowerCase("tr").includes(query));
}
function rows() {
  const records = filteredRecords();
  if (!records.length) return `<tr><td colspan="4" class="empty">${state.query ? "Aramanızla eşleşen kayıt bulunamadı." : `Henüz kayıt yok. Yukarıdaki “${singular[state.tab]} ekle” düğmesiyle ilk kaydı ekleyebilirsiniz.`}</td></tr>`;
  const tab = state.tab; const author = tab === "authors"; const campaign = tab === "campaigns";
  return records.map((item) => {
    const id = item.id ?? item.slug;
    const image = safeImage(author ? item.photo_url : campaign ? item.image_url : item.cover?.local_path);
    const title = oneLine(item.title ?? item.display ?? item.name);
    const active = campaign ? item.active : author ? true : isPublished(item);
    const thumb = image ? `<img class="record-thumb${author ? " record-thumb-author" : campaign ? " record-thumb-campaign" : ""}" src="${escape(image)}" alt="" loading="lazy">` : author ? `<span class="initial-avatar" aria-hidden="true">${escape(String(item.name ?? "").split(" ").slice(0, 2).map((v) => v[0]).join(""))}</span>` : "";
    const bookCount = author ? list("books").filter((b) => b.authors?.includes(item.name) || item.book_ids?.includes(b.id)).length : 0;
    const meta = campaign ? item.order : author ? `${bookCount} kitap` : item.author_display || item.authors?.join(", ") || "—";
    const sub = author ? item.slug : campaign ? oneLine(item.eyebrow) : item.isbn || item.id;
    const status = author ? "Kayıtlı" : active ? (campaign ? "Aktif" : "Yayında") : campaign ? "Pasif" : "Taslak";
    const preview = tab === "books" && hasPreview(item) ? '<span class="badge badge-preview">Önizleme</span>' : "";
    return `<tr><td class="cell-main"><div class="record-title">${thumb}<div><strong>${escape(title)}</strong><small>${escape(sub)}</small></div></div></td><td class="cell-meta">${escape(meta)}</td><td class="cell-status"><span class="badge${active ? "" : " badge-draft"}">${status}</span>${preview}</td><td class="cell-actions"><div class="row-actions"><button type="button" class="button button-small" data-edit="${escape(id)}" aria-label="${escape(title)} düzenle">Düzenle</button><button type="button" class="button button-small button-danger" data-delete="${escape(id)}" aria-label="${escape(title)} sil">Sil</button></div></td></tr>`;
  }).join("");
}
function renderRows() { $("#records").innerHTML = rows(); updateCount(); }
function updateCount() { const element = $("[data-table-count]", app); if (element) element.textContent = `${filteredRecords().length} kayıt`; }

/* ---------- Form parçaları ---------- */
function input(label, name, value = "", o = {}) {
  const attrs = [`name="${name}"`, `value="${escape(value)}"`, `type="${o.type || "text"}"`, o.required && "required", o.readonly && "readonly",
    o.min !== undefined && `min="${o.min}"`, o.max !== undefined && `max="${o.max}"`, o.maxlength && `maxlength="${o.maxlength}"`,
    o.placeholder && `placeholder="${escape(o.placeholder)}"`, o.attrs].filter(Boolean).join(" ");
  return `<label class="field${o.wide ? " field-wide" : ""}"><span class="field-label">${label}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</span><input ${attrs}>${o.help ? `<small>${o.help}</small>` : ""}</label>`;
}
const textarea = (label, name, value = "", o = {}) => `<label class="field field-wide"><span class="field-label">${label}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</span><textarea name="${name}" rows="${o.rows ?? 5}"${o.required ? " required" : ""}${o.mono ? ' class="mono"' : ""}${o.maxlength ? ` maxlength="${o.maxlength}"` : ""}>\n${escape(value)}</textarea>${o.help ? `<small>${o.help}</small>` : ""}</label>`;
const select = (label, name, value, values, o = {}) => `<label class="field${o.wide ? " field-wide" : ""}"><span class="field-label">${label}</span><select name="${name}">${values.map(([v, l]) => `<option value="${escape(v)}"${String(value ?? "") === String(v) ? " selected" : ""}>${escape(l)}</option>`).join("")}</select>${o.help ? `<small>${o.help}</small>` : ""}</label>`;
const section = (title, text = "") => `<div class="form-section"><h3>${title}</h3>${text ? `<p class="section-help">${text}</p>` : ""}</div>`;

function imageField({ label, name, value, kind = "", help, extra = "" }) {
  const url = safeImage(value);
  return `<div class="field field-wide image-field" data-image-field="${name}"><span class="field-label">${label}</span><div class="image-box"><div class="image-frame"><img class="image-preview" ${url ? `src="${escape(url)}"` : "hidden"} alt="${label} önizlemesi"><span class="image-empty"${url ? " hidden" : ""}>Görsel seçilmedi</span></div><div class="image-actions"><label class="button file-button">${url ? "Görseli değiştir" : "Görsel seç"}<input class="visually-hidden" type="file" accept="${IMAGE_TYPES.join(",")}" data-upload="${name}" data-kind="${kind}" aria-label="${label} için görsel seç"></label><button type="button" class="button" data-image-remove="${name}"${url ? "" : " hidden"}>Görseli kaldır</button><small>${help} PNG, JPEG veya WebP; en fazla 8 MB.</small></div></div><input type="hidden" name="${name}" value="${escape(value ?? "")}">${extra}</div>`;
}
function checklist({ name, items, selected = [], label, empty }) {
  if (!items.length) return `<p class="empty-note">${empty}</p>`;
  const chosen = new Set(selected);
  const rowsHtml = items.map((i) => `<li data-filter-text="${escape(`${i.label} ${i.sub ?? ""}`.toLocaleLowerCase("tr"))}"><label class="check-row"><input type="checkbox" name="${name}" value="${escape(i.value)}"${chosen.has(i.value) ? " checked" : ""}><span class="check-text"><span class="check-title">${escape(i.label)}</span>${i.sub ? `<small>${escape(i.sub)}</small>` : ""}</span>${i.badge ?? ""}</label></li>`).join("");
  return `<div class="checklist" data-checklist><input class="search-input" type="search" data-checklist-filter placeholder="${escape(label)}" aria-label="${escape(label)}" autocomplete="off"><ul class="check-list">${rowsHtml}</ul><p class="check-count" data-check-count aria-live="polite"></p></div>`;
}
function refreshChecklist(box) {
  const filter = $("[data-checklist-filter]", box).value.toLocaleLowerCase("tr").trim();
  box.querySelectorAll("li").forEach((li) => { li.hidden = Boolean(filter) && !li.dataset.filterText.includes(filter); });
  const all = box.querySelectorAll("input[type=checkbox]"); const chosen = box.querySelectorAll("input[type=checkbox]:checked");
  $("[data-check-count]", box).textContent = `${chosen.length} seçili · ${all.length} kitap`;
}

/* ---------- Pencere (diyalog) iskeleti ---------- */
function closeDialog() { if (dialog.open) dialog.close(); dialogContext = null; }
function requestClose() {
  if (state.saving) return;
  const form = $("form", dialog);
  if (form?.dataset.dirty === "true" && !window.confirm("Kaydedilmemiş değişiklikleriniz var. Pencereyi kapatırsanız bu değişiklikler kaybolur. Kapatılsın mı?")) return;
  closeDialog();
}
function openDialog({ title, body, submit = "Kaydet", danger = false, size = "wide", plain = false, onSubmit }) {
  dialog.dataset.size = size;
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="editor-title">${escape(title)}</h2><button type="button" class="close-dialog" data-close aria-label="Pencereyi kapat">×</button></div><form class="dialog-form" id="dialog-form"><fieldset class="form-fieldset"><div class="editor-body"><p class="form-error" role="alert" data-form-error hidden></p>${plain ? body : `<div class="editor-grid">${body}</div>`}</div></fieldset><div class="editor-footer form-actions"><span class="save-status" data-status aria-live="polite"></span><button class="button" type="button" data-close>Vazgeç</button><button class="button ${danger ? "button-danger-solid" : "button-primary"}" type="submit">${submit}</button></div></form>`;
  const form = $("#dialog-form");
  form.addEventListener("submit", (event) => { event.preventDefault(); onSubmit(form, new FormData(form)); });
  dialog.showModal();
  (form.querySelector("[autofocus]") ?? form.querySelector("input:not([type=hidden]):not([type=file]):not([readonly]), textarea"))?.focus();
  return form;
}
const CONTENT_KEYS = ["books", "authors", "campaigns", "site", "vitrin", "pages", "categories"];
function applyResult(result) {
  for (const key of CONTENT_KEYS) if (result?.[key] !== undefined && result[key] !== null) state.content[key] = result[key];
}
async function syncContent(result) {
  // Sunucu kaydet/sil yanıtında güncel içeriğin tamamını döndürür; eksikse içeriği yeniden okuruz.
  applyResult(result);
  if (CONTENT_KEYS.every((key) => result?.[key] !== undefined)) return;
  // Kayıt tamamlandı: liste yenilenemezse yinelenen gönderime yol açmamak için yalnızca uyarı veririz.
  try { await loadContent(); } catch (error) { toast(`Kayıt tamamlandı; liste yenilenemedi. ${error.message}`, "error"); }
}

/* ---------- Kitap, yazar, duyuru formları ---------- */
const knownCategories = () => list("categories").map((c) => c.ad ?? c).filter(Boolean);
function categoryField(selected) {
  const known = knownCategories();
  if (!known.length) return input("Kategoriler", "categories_text", selected.join(", "), { wide: true, help: "Virgülle ayırın: Tarih, Araştırma - İnceleme, İslam" });
  const extra = selected.filter((c) => !known.includes(c));
  const box = (value) => `<label class="check-chip"><input type="checkbox" name="categories" value="${escape(value)}"${selected.includes(value) ? " checked" : ""}><span>${escape(value)}</span></label>`;
  // Listede olmayan ham kategori kayıtları silinmez; kaydederken olduğu gibi geri eklenir (bkz. buildBody).
  return `<fieldset class="field field-wide category-field"><legend class="visually-hidden">Kategoriler</legend><div class="chip-grid">${known.map(box).join("")}</div>${extra.length ? `<p class="section-help">Bu kitapta ayrıca listede olmayan ${extra.length} kategori kaydı var; olduğu gibi korunur: ${extra.map(escape).join(" · ")}</p>` : ""}</fieldset>`;
}
function chosenCategories(item, data) {
  if (data.has("categories_text")) return split(data.get("categories_text"));
  const known = knownCategories(); const chosen = data.getAll("categories"); const before = item.categories ?? [];
  return [...before.filter((c) => !known.includes(c) || chosen.includes(c)), ...chosen.filter((c) => !before.includes(c))];
}
function previewSection(item) {
  const note = item.onizleme_var ? '<p class="inline-note">Bu kitabın sitede zaten bir önizlemesi var. İsterseniz buraya kendi sayfalarınızı da ekleyebilirsiniz.</p>' : "";
  return `<div class="form-section field-wide preview-section"><h3 id="preview-title">Önizleme sayfaları</h3><p class="section-help">Okurlar sitede bu sayfaları çevirerek kitaba göz atar. En fazla ${MAX_PREVIEW} sayfa; telif için ilk 8–10 sayfa önerilir. Seçtiğiniz dosyalar ada göre sıralanarak eklenir; sırayı sonradan ↑ ↓ ile değiştirebilirsiniz.</p>${note}<p class="preview-counter" data-preview-counter aria-live="polite"></p><ol class="preview-list" data-preview-list aria-labelledby="preview-title"></ol><label class="button file-button" data-preview-picker>Sayfa görselleri ekle<input class="visually-hidden" type="file" multiple accept="${IMAGE_TYPES.join(",")}" data-preview-upload aria-label="Önizleme sayfası görselleri seç"></label></div>`;
}
function bookFields(item, editing) {
  return `${section("Temel bilgiler")}${input("Kitap adı", "title", item.title, { required: true, maxlength: 300, wide: true })}${input("Alt başlık", "subtitle", item.subtitle, { wide: true })}${input("Yazarlar", "authors", item.authors?.join(", "), { help: "Birden fazla yazarı virgülle ayırın." })}${input("Sitede görünen yazar adı", "author_display", item.author_display, { placeholder: "Örn. Prof. Dr. Ali Seyyar" })}${select("Yayın durumu", "status", item.status || "published", [["published", "Yayında"], ["draft", "Taslak (sitede görünmez)"]])}${input("Sayfa adresi", "id", item.id, { required: true, readonly: editing, help: editing ? "Yayınlanmış kitabın adresi değiştirilemez." : "Kitap adından kendiliğinden oluşur. Küçük harf, rakam ve tire kullanın." })}
${section("Kapak ve tanıtım")}${imageField({ label: "Kitap kapağı", name: "cover_path", value: item.cover?.local_path, kind: "cover", help: "Dikey kitap kapağı önerilir.", extra: `<input type="hidden" name="cover_width" value="${escape(item.cover?.width ?? "")}"><input type="hidden" name="cover_height" value="${escape(item.cover?.height ?? "")}">` })}${textarea("Tanıtım metni", "description", item.description, { rows: 7 })}
${section("Künye")}${input("ISBN", "isbn", item.isbn, { maxlength: 17 })}${input("Sayfa sayısı", "pages", item.pages, { type: "number", min: 1 })}${input("Yayın tarihi", "publish_date", item.publish_date, { placeholder: "2026, 2026-10 veya 2026-10-14" })}${input("Boyutlar", "dimensions", item.dimensions, { placeholder: "13,5 × 21 cm" })}${input("Kapak / cilt türü", "binding", item.binding, { placeholder: "Karton Kapak" })}${input("Dizi / seri", "series", item.series)}<label class="checkbox-field field-wide"><input type="checkbox" name="is_set"${item.is_set ? " checked" : ""}>Set veya takım kitap</label>
${section("Kategoriler")}${categoryField(item.categories ?? [])}${previewSection(item)}
${section("Satış bağlantıları", "Kitabın satıldığı sayfaların adresleri (https:// ile başlar). Boş bırakılanlar sitede gösterilmez.")}${input("Kitapyurdu", "source_kitapyurdu", item.sources?.kitapyurdu, { type: "url" })}${input("Küresel Kitap", "source_kureselkitap", item.sources?.kureselkitap, { type: "url" })}${input("Nobel Kitap", "source_nobelkitap", item.sources?.nobelkitap, { type: "url", wide: true })}`;
}
function authorFields(item, editing) {
  const items = [...list("books")].sort(byTitle).map((b) => ({ value: b.id, label: b.title, sub: b.author_display ?? "" }));
  return `${input("Yazar adı", "name", item.name, { required: true, maxlength: 200 })}${input("Sayfa adresi", "slug", item.slug, { required: true, readonly: editing, help: editing ? "Yayınlanmış yazarın adresi değiştirilemez." : "Yazar adından kendiliğinden oluşur." })}${input("Sitede görünen adı", "display", item.display, { wide: true, help: "Unvan eklemek için kullanabilirsiniz." })}${imageField({ label: "Yazar portresi", name: "photo_url", value: item.photo_url, help: "Kare ve yüzün ortada olduğu bir fotoğraf önerilir." })}${textarea("Biyografi", "bio", item.bio, { rows: 7 })}<div class="field field-wide"><span class="field-label">İlişkili kitaplar</span>${checklist({ name: "book_ids", items, selected: item.book_ids ?? [], label: "Kitap ara…", empty: "Henüz katalogda kitap yok." })}<small>Kitabın yazar alanına bu ismi yazarsanız ilişki kendiliğinden kurulur.</small></div>`;
}
function campaignFields(item, editing) {
  const books = list("books").filter((b) => isPublished(b) || b.id === item.book_id).sort(byTitle);
  return `${textarea("Duyuru başlığı", "title", item.title, { required: true, rows: 2, maxlength: 300, help: "Satır başı koyarak başlığı iki satıra bölebilirsiniz." })}${input("Sayfa adresi", "id", item.id, { required: true, readonly: editing })}${input("Üst etiket", "eyebrow", item.eyebrow, { placeholder: "Yeni kitap / Okuma seçkisi" })}${input("Gösterim sırası", "order", item.order ?? 0, { type: "number", min: 0, max: 9999, help: "Küçük sayı önce gösterilir." })}${textarea("Kısa açıklama", "description", item.description, { rows: 3 })}${imageField({ label: "Reklam görseli", name: "image_url", value: item.image_url, help: "Yatay görsel önerilir. Boş bırakırsanız seçilen kitap kapağı gösterilir." })}${select("İlişkili kitap", "book_id", item.book_id ?? "", [["", "Kitap seçin (isteğe bağlı)"], ...books.map((b) => [b.id, b.title])])}${select("Arka plan rengi", "theme", item.theme || "peach", [["peach", "Şeftali"], ["sage", "Adaçayı"], ["cream", "Krem"]])}${input("Buton yazısı", "button_label", item.button_label || "Kitabı incele")}${input("Hedef bağlantı", "link_url", item.link_url, { placeholder: "/kitaplar/ veya https://…", help: "Boş bırakırsanız seçilen kitaba yönlendirir." })}<label class="checkbox-field field-wide"><input type="checkbox" name="active"${item.active !== false ? " checked" : ""}>Ana sayfada göster</label>`;
}
function buildBody(resource, item, data) {
  const value = (name) => String(data.get(name) ?? "").replace(/\r\n?/g, "\n").trim();
  if (resource === "books") {
    const { onizleme_var: _readOnly, ...rest } = item;
    const authors = split(value("authors"));
    const body = { ...rest, id: value("id"), title: value("title"), subtitle: value("subtitle") || null, authors, author_display: value("author_display") || authors.join(", ") || null, isbn: value("isbn") || null, pages: value("pages") ? Number(value("pages")) : null, publish_date: value("publish_date") || null, categories: chosenCategories(item, data), description: value("description"), status: value("status"), dimensions: value("dimensions") || null, binding: value("binding") || null, series: value("series") || null, is_set: data.has("is_set"), cover: { ...item.cover, local_path: value("cover_path") || null, width: numberOrNull(value("cover_width")), height: numberOrNull(value("cover_height")) }, sources: { ...item.sources, kitapyurdu: value("source_kitapyurdu") || null, kureselkitap: value("source_kureselkitap") || null, nobelkitap: value("source_nobelkitap") || null } };
    const pages = dialogContext?.previewPages ?? [];
    if (pages.length || Array.isArray(item.preview_pages)) body.preview_pages = pages.map(({ local_path, width, height }) => ({ local_path, width, height }));
    return body;
  }
  if (resource === "authors") return { ...item, name: value("name"), slug: value("slug"), display: value("display") || value("name"), bio: value("bio") || null, photo_url: value("photo_url") || null, book_ids: data.getAll("book_ids") };
  return { ...item, id: value("id"), title: value("title"), eyebrow: value("eyebrow"), description: value("description"), image_url: value("image_url") || null, book_id: value("book_id") || null, link_url: value("link_url") || null, button_label: value("button_label"), order: Number(value("order")), theme: value("theme"), active: data.has("active") };
}
function openRecordEditor(resource, item = {}) {
  const editing = Boolean(item.id || item.slug);
  dialogContext = { previewPages: resource === "books" ? (item.preview_pages ?? []).map((p) => ({ ...p })) : [] };
  const body = { books: bookFields, authors: authorFields, campaigns: campaignFields }[resource](item, editing);
  const form = openDialog({ title: `${singular[resource]} ${editing ? "düzenle" : "ekle"}`, body, submit: editing ? "Değişiklikleri kaydet" : "Kaydet", onSubmit: (f, data) => submitRecord(f, resource, item, editing, data) });
  if (!editing) {
    const source = form.elements.namedItem(resource === "authors" ? "name" : "title"); const target = form.elements.namedItem(resource === "authors" ? "slug" : "id"); let custom = false;
    target.addEventListener("input", () => { custom = Boolean(target.value); });
    source.addEventListener("input", () => { if (!custom) target.value = slug(source.value); });
  }
  if (resource === "books") renderPreviewList();
  dialog.querySelectorAll("[data-checklist]").forEach(refreshChecklist);
}
async function submitRecord(form, resource, item, editing, data) {
  await guarded(form, BUILD_MESSAGE, async () => {
    clearError(form);
    try {
      const path = `${resource}${editing ? `/${encodeURIComponent(item.id ?? item.slug)}` : ""}`;
      const result = await api(path, { method: editing ? "PUT" : "POST", body: JSON.stringify(buildBody(resource, item, data)) });
      await syncContent(result);
      form.dataset.dirty = "false";
      closeDialog();
      state.tab = resource;
      renderMain();
      $("#page-title")?.focus({ preventScroll: true });
      toast(`${singular[resource]} kaydedildi. Site güncellendi.`);
    } catch (error) { showError(form, error.message); }
  });
}
function confirmDelete(id) {
  const resource = state.tab; const item = list(resource).find((record) => (record.id ?? record.slug) === id);
  if (!item) return;
  const consequence = { books: "Kitap katalogdan, ana sayfa vitrininden ve duyurulardan kaldırılacak. Kitabı saklamak isterseniz silmek yerine yayın durumunu Taslak yapın.", authors: "Yazar profili kaldırılacak. Kitaplar katalogda kalacak.", campaigns: "Duyuru ana sayfadan ve yönetim listesinden kaldırılacak." }[resource];
  openDialog({ title: `${singular[resource]} silinsin mi?`, size: "narrow", plain: true, danger: true, submit: "Evet, sil",
    body: `<div class="confirmation-body"><h3>${escape(oneLine(item.title ?? item.display ?? item.name))}</h3><p>${consequence}</p><p>Bu işlem geri alınamaz.</p></div>`,
    onSubmit: (form) => guarded(form, "Siliniyor ve site güncelleniyor…", async () => {
      try {
        const result = await api(`${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
        await syncContent(result);
        closeDialog();
        renderMain();
        $("#page-title")?.focus({ preventScroll: true });
        toast(`${singular[resource]} kaldırıldı. Site güncellendi.`);
      } catch (error) { showError(form, error.message); }
    }) });
  $("button[type=submit]", dialog).focus();
}

/* ---------- Görsel yükleme ---------- */
function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}
function imageProblem(file) {
  if (file.type && !IMAGE_TYPES.includes(file.type)) return "Yalnızca PNG, JPEG veya WebP resim yüklenebilir.";
  if (file.size > MAX_UPLOAD) return `Görsel 8 MB’dan küçük olmalıdır (bu dosya ${formatSize(file.size)}).`;
  return "";
}
async function uploadFile(file, kind) {
  const body = { filename: file.name, data: await readBase64(file) };
  if (kind) body.kind = kind;
  return api("upload", { method: "POST", body: JSON.stringify(body) });
}
function setImage(form, name, value, result) {
  form.elements.namedItem(name).value = value ?? "";
  if (name === "cover_path") { form.elements.namedItem("cover_width").value = result?.width ?? ""; form.elements.namedItem("cover_height").value = result?.height ?? ""; }
  const box = $(`[data-image-field="${name}"]`, form); const url = safeImage(value);
  const preview = $(".image-preview", box);
  preview.hidden = !url; if (url) preview.src = url; else preview.removeAttribute("src");
  $(".image-empty", box).hidden = Boolean(url);
  $("[data-image-remove]", box).hidden = !url;
  box.querySelector(".file-button").firstChild.textContent = url ? "Görseli değiştir" : "Görsel seç";
  markDirty(form);
}
async function uploadImageField(fileInput) {
  const file = fileInput.files?.[0]; const form = fileInput.form;
  if (!file) return;
  clearError(form);
  const problem = imageProblem(file);
  if (problem) { showError(form, problem); fileInput.value = ""; return; }
  const name = fileInput.dataset.upload;
  await guarded(form, "Görsel yükleniyor…", async () => {
    try { const result = await uploadFile(file, fileInput.dataset.kind); setImage(form, name, name === "cover_path" ? result.local_path : result.url, result); }
    catch (error) { showError(form, error.message); }
  });
  fileInput.value = "";
}
function renderPreviewList(focusSelector = "") {
  const pages = dialogContext.previewPages; const last = pages.length - 1;
  $("[data-preview-list]", dialog).innerHTML = pages.length ? pages.map((p, i) => `<li class="preview-item"><img class="preview-thumb" src="${escape(safeImage(p.local_path))}" alt="" loading="lazy"><span class="preview-name">Sayfa ${i + 1}</span><span class="preview-actions"><button type="button" class="button button-small" data-preview-move="${i}" data-dir="-1" aria-label="Sayfa ${i + 1} yukarı taşı"${i === 0 ? " disabled" : ""}>↑</button><button type="button" class="button button-small" data-preview-move="${i}" data-dir="1" aria-label="Sayfa ${i + 1} aşağı taşı"${i === last ? " disabled" : ""}>↓</button><button type="button" class="button button-small button-danger" data-preview-remove="${i}" aria-label="Sayfa ${i + 1} kaldır">Kaldır</button></span></li>`).join("") : '<li class="preview-empty">Henüz önizleme sayfası eklenmedi.</li>';
  $("[data-preview-counter]", dialog).textContent = `${pages.length} / ${MAX_PREVIEW} sayfa`;
  const full = pages.length >= MAX_PREVIEW;
  $("[data-preview-picker]", dialog).hidden = full;
  if (focusSelector) $(focusSelector, dialog)?.focus();
}
async function uploadPreviewPages(fileInput) {
  const form = fileInput.form; const pages = dialogContext.previewPages;
  const files = [...fileInput.files].sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true }));
  fileInput.value = "";
  if (!files.length) return;
  clearError(form);
  const room = MAX_PREVIEW - pages.length; const chosen = files.slice(0, room); const skipped = files.length - chosen.length;
  const problems = skipped ? [`En fazla ${MAX_PREVIEW} sayfa eklenebilir; ${skipped} dosya eklenmedi.`] : [];
  await guarded(form, "", async () => {
    let added = 0;
    for (const [index, file] of chosen.entries()) {
      busyText = `Sayfa görselleri yükleniyor… ${index + 1} / ${chosen.length}`;
      paintStatus(form);
      const problem = imageProblem(file);
      if (problem) { problems.push(`${file.name}: ${problem}`); continue; }
      try {
        const result = await uploadFile(file, "preview");
        pages.push({ local_path: result.local_path, width: result.width, height: result.height });
        added += 1;
        renderPreviewList();
      } catch (error) { problems.push(`${file.name}: ${error.message}`); }
    }
    if (added) markDirty(form);
    if (problems.length) showError(form, problems.join(" "));
  });
  renderPreviewList();
}

/* ---------- Ana sayfa vitrini ---------- */
function vitrinView() {
  const v = state.content.vitrin;
  if (!v) return notReady("Ana sayfa vitrini");
  const books = list("books"); const published = books.filter(isPublished); const index = new Map(books.map((b) => [b.id, b]));
  const [eyebrow, text] = SECTIONS.vitrin;
  const featured = [["", "Otomatik seç (önizlemesi olan ilk kitap)"], ...[...published].sort(byTitle).map((b) => [b.id, b.title])];
  if (v.one_cikan && !published.some((b) => b.id === v.one_cikan)) featured.push([v.one_cikan, `${index.get(v.one_cikan)?.title ?? v.one_cikan} (taslak veya silinmiş; sitede gösterilmez)`]);
  const shelfSaved = v.onizleme_vitrini ?? [];
  const shelfPool = published.filter((b) => hasPreview(b) || shelfSaved.includes(b.id));
  const shelf = [...shelfSaved.map((id) => shelfPool.find((b) => b.id === id)).filter(Boolean), ...shelfPool.filter((b) => !shelfSaved.includes(b.id)).sort(byTitle)]
    .map((b) => ({ value: b.id, label: b.title, sub: b.author_display ?? "", badge: hasPreview(b) ? '<span class="badge badge-preview">Önizleme</span>' : '<span class="badge badge-draft">Önizlemesi yok</span>' }));
  const hidden = v.vitrin_haric ?? [];
  const excluded = [...books].sort((a, b) => Number(hidden.includes(b.id)) === Number(hidden.includes(a.id)) ? byTitle(a, b) : Number(hidden.includes(b.id)) - Number(hidden.includes(a.id)))
    .map((b) => ({ value: b.id, label: b.title, sub: b.author_display ?? "", badge: isPublished(b) ? "" : '<span class="badge badge-draft">Taslak</span>' }));
  return `${heading(eyebrow, TAB_LABEL.vitrin, text, viewSite)}
<form id="vitrin-form" class="panel-form"><fieldset class="form-fieldset">
<section class="form-card"><h2>Öne çıkan kitap</h2><p class="card-help">Ana sayfanın en üstünde büyük gösterilen kitap. Yalnızca yayındaki kitaplar seçilebilir.</p>${select("Öne çıkan kitap", "one_cikan", v.one_cikan ?? "", featured, { wide: true })}</section>
<section class="form-card"><h2>“Sayfalarına göz atın” rafı</h2><p class="card-help">Ana sayfadaki bu rafta, önizlemesi olan hangi kitapların gösterileceğini işaretleyin. Önizlemesi olmayan kitaplar rafta gösterilemez; bir kitaba önizleme eklemek için Kitaplar bölümünde o kitabı düzenleyin.</p>${checklist({ name: "onizleme_vitrini", items: shelf, selected: shelfSaved, label: "Raf için kitap ara…", empty: "Henüz önizlemesi olan yayında kitap yok. Kitaplar bölümünde bir kitabı düzenleyip “Önizleme sayfaları” bölümüne görsel ekleyin." })}</section>
<section class="form-card"><h2>Ana sayfada gösterilmeyecek kitaplar</h2><p class="card-help">İşaretlediğiniz kitaplar katalogda ve kendi sayfalarında görünmeye devam eder; yalnızca ana sayfadaki vitrin alanlarında gösterilmez.</p>${checklist({ name: "vitrin_haric", items: excluded, selected: hidden, label: "Gizlenecek kitabı ara…", empty: "Henüz katalogda kitap yok." })}</section>
<section class="form-card"><h2>Kaç öğe gösterilsin?</h2><div class="form-row">${input("“Yeni çıkanlar” sayısı", "yeni_cikanlar_adet", v.yeni_cikanlar_adet ?? 8, { type: "number", min: 1, max: 12, required: true, help: "1 ile 12 arasında." })}${input("“Yazarlar” sayısı", "yazar_seridi_adet", v.yazar_seridi_adet ?? 8, { type: "number", min: 1, max: 12, required: true, help: "1 ile 12 arasında." })}</div></section>
</fieldset>${formBar("Vitrini kaydet")}</form>`;
}
const formBar = (label) => `<div class="form-bar form-actions"><p class="form-error" role="alert" data-form-error hidden></p><div class="form-bar-row"><span class="save-status" data-status aria-live="polite"></span><button class="button button-primary" type="submit">${label}</button></div></div>`;
async function saveVitrin(form, data) {
  const previous = state.content.vitrin; const keep = (name, old) => { const chosen = data.getAll(name); return [...old.filter((id) => chosen.includes(id)), ...chosen.filter((id) => !old.includes(id))]; };
  const body = { ...previous, one_cikan: String(data.get("one_cikan") || "") || null, onizleme_vitrini: keep("onizleme_vitrini", previous.onizleme_vitrini ?? []), vitrin_haric: keep("vitrin_haric", previous.vitrin_haric ?? []), yeni_cikanlar_adet: Number(data.get("yeni_cikanlar_adet")), yazar_seridi_adet: Number(data.get("yazar_seridi_adet")) };
  await guarded(form, BUILD_MESSAGE, async () => {
    clearError(form);
    try {
      await syncContent(await api("vitrin", { method: "PUT", body: JSON.stringify(body) }));
      renderMain(); $("#page-title")?.focus({ preventScroll: true }); toast("Ana sayfa vitrini kaydedildi. Site güncellendi.");
    } catch (error) { showError(form, error.message); }
  });
}

/* ---------- Sayfa metinleri ---------- */
function pagesView() {
  if (state.content.pages === null) return notReady("Sayfa metinleri");
  const [eyebrow, text] = SECTIONS.pages; const pages = list("pages");
  const rowsHtml = pages.length ? pages.map((p) => `<tr><td class="cell-main"><div class="record-title"><div><strong>${escape(p.title)}</strong><small>${escape(p.slug === "404" ? "/404.html" : `/${p.slug}/`)}</small></div></div></td><td class="cell-meta cell-wide">${escape(oneLine(p.description).slice(0, 130))}</td><td class="cell-actions"><div class="row-actions"><button type="button" class="button button-small" data-edit-page="${escape(p.slug)}" aria-label="Metni düzenle: ${escape(p.title)}">Metni düzenle</button></div></td></tr>`).join("") : '<tr><td colspan="3" class="empty">Düzenlenebilir sayfa bulunamadı.</td></tr>';
  return `${heading(eyebrow, TAB_LABEL.pages, text, viewSite)}<div class="content-card"><div class="table-scroll"><table class="data-table"><caption class="visually-hidden">Düzenlenebilir sayfalar</caption><thead><tr><th scope="col">Sayfa</th><th scope="col">Açıklama (arama motorları için)</th><th scope="col" class="align-right">İşlemler</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></div>`;
}
function openPageEditor(pageSlug) {
  const page = list("pages").find((p) => p.slug === pageSlug);
  if (!page) return;
  const site = state.content.site ?? {};
  const tokens = [
    ["{telefon_gosterim}", "Telefon numarası", site.numara ?? site.telefon_gosterim],
    ["{whatsapp_url}", "WhatsApp bağlantısı", site.whatsapp_url],
    ["{eposta}", "E-posta adresi", site.eposta],
    ["{adres}", "Adres", site.adres],
    ["{sosyal_liste}", "Sosyal medya listesi", "hazır madde listesi"],
  ];
  dialogContext = { insertTarget: "body", previewPages: [] };
  const body = `${input("Sayfa başlığı", "title", page.title, { required: true, wide: true, maxlength: 200 })}${textarea("Açıklama (arama motorları için)", "description", page.description, { rows: 3, maxlength: 400, help: 'Google gibi arama sonuçlarında sayfa başlığının altında görünen kısa özet. Aşağıdaki hazır bilgileri burada da kullanabilirsiniz. <span data-char-count></span>' })}
<div class="field field-wide"><label class="field-label" for="page-body">Sayfa metni</label><textarea id="page-body" name="body" class="mono" rows="18">\n${escape(page.body)}</textarea>
<div class="insert-bar" role="group" aria-label="Metne hazır bilgi ekle"><span>Son tıkladığınız kutuda imlecin olduğu yere ekle:</span>${tokens.map(([token, label]) => `<button type="button" class="button button-small" data-insert="${escape(token)}">${label}</button>`).join("")}</div>
<small>Bu bilgiler siteye yazılırken güncel değerle değişir. Yer tutucuları aynen, süslü parantezle yazın; yanlış yazılırsa kayıt sırasında uyarı verilir. Şu anki değerler: ${tokens.map(([token, label, value]) => `<code>${escape(token)}</code> ${label.toLocaleLowerCase("tr")}: ${escape(value ?? "tanımsız")}`).join("; ")}.</small>
${/\[\[SORU/.test(page.body ?? "") ? "<p class=\"inline-note\">“[[SORU: …]]” ile işaretli cümleler yayınevine sorulmuş sorulardır; sitede görünmez. Cevabı öğrenince işareti silip yerine gerçek bilgiyi yazın.</p>" : ""}
<details class="md-help"><summary>Yazıyı biçimlendirme ipuçları</summary><ul><li><code>## Başlık</code> ara başlık yapar.</li><li><code>**kalın yazı**</code> yazıyı kalın yapar.</li><li><code>[bağlantı yazısı](https://adres)</code> bağlantı oluşturur.</li><li><code>- madde</code> liste yapar (her satırın başına).</li><li>Paragrafları bir boş satırla ayırın.</li></ul></details></div>`;
  const form = openDialog({ title: `Sayfa metni: ${page.title}`, body, size: "wide", onSubmit: (f, data) => savePage(f, page, data) });
  updateCharCount(form);
}
const updateCharCount = (form) => { const counter = $("[data-char-count]", form); const field = form.elements.namedItem("description"); if (counter && field) counter.textContent = `${field.value.length} karakter (ilk yaklaşık 160 karakter görünür).`; };
async function savePage(form, page, data) {
  const value = (name) => String(data.get(name) ?? "").replace(/\r\n?/g, "\n");
  const body = { title: value("title").trim(), description: value("description").trim(), body: value("body") };
  await guarded(form, BUILD_MESSAGE, async () => {
    clearError(form);
    try {
      const result = await api(`pages/${encodeURIComponent(page.slug)}`, { method: "PUT", body: JSON.stringify(body) });
      if (result.page && !result.pages) state.content.pages = list("pages").map((p) => (p.slug === page.slug ? { ...p, ...result.page } : p));
      await syncContent(result);
      form.dataset.dirty = "false"; closeDialog(); renderMain(); $("#page-title")?.focus({ preventScroll: true });
      toast("Sayfa metni kaydedildi. Site güncellendi.");
    } catch (error) { showError(form, error.message); }
  });
}

/* ---------- Site ayarları ---------- */
function whatsappLink(raw) {
  const text = String(raw ?? "").trim(); const digits = text.replace(/\D/g, "");
  if (!digits) return { valid: false, link: "" };
  let international = digits;
  if (text.startsWith("+")) international = digits;
  else if (digits.startsWith("00")) international = digits.slice(2);
  else if (digits.startsWith("0")) international = `90${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("5")) international = `90${digits}`;
  const valid = international.length >= 11 && international.length <= 15 && (!international.startsWith("90") || international.length === 12);
  return { valid, link: valid ? `https://wa.me/${international}` : "" };
}
function updateWhatsapp(field) {
  const result = whatsappLink(field.value); const out = $("[data-wa-preview]", field.closest("form"));
  out.textContent = result.valid ? result.link : "Numara anlaşılamadı. Örnek: 0505 980 87 35";
  out.classList.toggle("is-invalid", !result.valid);
}
function channelRow(c = {}) {
  return `<fieldset class="repeater-row" data-channel><legend class="repeater-legend"></legend><div class="repeater-grid">${input("Satış noktasının adı", "channel_name", c.ad, { required: true, maxlength: 200, placeholder: "Örn. Kitapyurdu" })}${input("Web adresi", "channel_url", c.url, { type: "url", placeholder: "https://…", help: "Boş bırakırsanız bu satış noktası sitede gösterilmez." })}${input("Not (isteğe bağlı)", "channel_note", c.not, { wide: true, placeholder: "Örn. Yayınevi sayfası" })}</div><div class="repeater-actions"><button type="button" class="button button-small" data-action="channel-up">↑ Yukarı</button><button type="button" class="button button-small" data-action="channel-down">↓ Aşağı</button><button type="button" class="button button-small button-danger" data-action="channel-remove">Kaldır</button></div></fieldset>`;
}
function renumberChannels() {
  app.querySelectorAll("[data-channel]").forEach((row, i) => {
    $(".repeater-legend", row).textContent = `Satış noktası ${i + 1}`;
    const names = { "channel-up": "yukarı taşı", "channel-down": "aşağı taşı", "channel-remove": "kaldır" };
    row.querySelectorAll("[data-action]").forEach((b) => b.setAttribute("aria-label", `Satış noktası ${i + 1} ${names[b.dataset.action]}`));
  });
}
function siteView() {
  const s = state.content.site;
  if (!s) return notReady("Site ayarları");
  const [eyebrow, text] = SECTIONS.site; const social = s.sosyal ?? {};
  return `${heading(eyebrow, TAB_LABEL.site, text, viewSite)}
<form id="site-form" class="panel-form"><fieldset class="form-fieldset">
<section class="form-card"><h2>Telefon ve WhatsApp</h2><p class="card-help">Ziyaretçiler WhatsApp ikonuna basınca bu numaraya yazar. Aynı numara sitede telefon olarak da gösterilir.</p>${input("Telefon ve WhatsApp numarası", "numara", s.numara ?? s.telefon_gosterim ?? "", { required: true, type: "tel", wide: true, maxlength: 30, placeholder: "0505 980 87 35", attrs: 'inputmode="tel" autocomplete="off" data-wa-field', help: "Başında 0 ya da +90 yazabilirsiniz." })}<div class="link-preview"><span class="link-preview-label">WhatsApp bağlantısı (kaydedince oluşur)</span><code data-wa-preview aria-live="polite"></code></div></section>
<section class="form-card"><h2>İletişim bilgileri</h2><div class="form-row">${input("E-posta", "eposta", s.eposta, { type: "email", maxlength: 200, attrs: 'autocomplete="off"' })}${input("Adres", "adres", s.adres, { maxlength: 300 })}${input("Slogan", "slogan", s.slogan, { wide: true, maxlength: 200, help: "Sitenin üst kısmında görünen kısa söz." })}</div></section>
<section class="form-card"><h2>Sosyal medya</h2><p class="card-help">Hesap sayfanızın tam adresi (https:// ile başlar). Boş bırakılan hesap sitede gösterilmez.</p><div class="form-row">${input("X (Twitter)", "sosyal_x", social.x, { type: "url", placeholder: "https://x.com/…" })}${input("Instagram", "sosyal_instagram", social.instagram, { type: "url", placeholder: "https://www.instagram.com/…" })}${input("Facebook", "sosyal_facebook", social.facebook, { type: "url", placeholder: "https://www.facebook.com/…", wide: true })}</div></section>
<section class="form-card"><h2>Satış noktaları</h2><p class="card-help">“Nereden alınır” bölümünde görünen mağazalar ve siteler. Sıra burada göründüğü gibidir.</p><div data-channels>${(s.satis_kanallari ?? []).map(channelRow).join("")}</div><button type="button" class="button" data-action="channel-add">+ Satış noktası ekle</button></section>
</fieldset>${formBar("Site ayarlarını kaydet")}</form>`;
}
async function saveSite(form, data) {
  const value = (name) => String(data.get(name) ?? "").trim();
  const channels = [...form.querySelectorAll("[data-channel]")].map((row) => { const get = (name) => $(`[name="${name}"]`, row).value.trim(); return { ad: get("channel_name"), url: get("channel_url") || null, not: get("channel_note") }; });
  const body = { numara: value("numara"), eposta: value("eposta"), adres: value("adres"), slogan: value("slogan"), sosyal: { x: value("sosyal_x"), instagram: value("sosyal_instagram"), facebook: value("sosyal_facebook") }, satis_kanallari: channels };
  await guarded(form, BUILD_MESSAGE, async () => {
    clearError(form);
    try {
      await syncContent(await api("site", { method: "PUT", body: JSON.stringify(body) }));
      renderMain(); $("#page-title")?.focus({ preventScroll: true }); toast("Site ayarları kaydedildi. Site güncellendi.");
    } catch (error) { showError(form, error.message); }
  });
}

/* ---------- Şifre değiştirme ---------- */
function openPasswordDialog() {
  const attrs = (autocomplete) => `data-pw autocomplete="${autocomplete}"`;
  const body = `${input("Şu anki şifre", "current", "", { type: "password", required: true, wide: true, attrs: attrs("current-password") })}${input("Yeni şifre", "next", "", { type: "password", required: true, attrs: `${attrs("new-password")} minlength="8"`, help: "En az 8 karakter." })}${input("Yeni şifre (tekrar)", "again", "", { type: "password", required: true, attrs: `${attrs("new-password")} minlength="8"` })}<label class="checkbox-field field-wide"><input type="checkbox" data-show-password>Şifreleri göster</label>`;
  openDialog({ title: "Şifre değiştir", size: "narrow", submit: "Şifreyi değiştir", body, onSubmit: (form, data) => guarded(form, "Şifre değiştiriliyor…", async () => {
    clearError(form);
    const next = String(data.get("next")); const current = String(data.get("current"));
    if (next !== String(data.get("again"))) { showError(form, "Yeni şifre iki kutuda aynı değil. Lütfen aynısını yazın."); return; }
    if (next === current) { showError(form, "Yeni şifre eskisiyle aynı. Farklı bir şifre seçin."); return; }
    try { await api("password", { method: "POST", body: JSON.stringify({ current, next }) }); form.dataset.dirty = "false"; closeDialog(); toast("Şifreniz değiştirildi. Bir sonraki girişte yeni şifrenizi kullanın."); }
    catch (error) { showError(form, error.message); }
  }) });
}
function togglePasswords(checkbox) {
  checkbox.closest("form").querySelectorAll("input[data-pw]").forEach((field) => { field.type = checkbox.checked ? "text" : "password"; });
}

/* ---------- Olaylar ---------- */
const VIEWS = { overview, books: collection, authors: collection, campaigns: collection, vitrin: vitrinView, pages: pagesView, site: siteView };

async function logout() {
  try { await api("logout", { method: "POST", body: "{}" }); state.csrfToken = ""; state.content = emptyContent(); renderLogin(); }
  catch (error) { toast(error.message, "error"); }
}
function moveChannel(button, direction) {
  const row = button.closest("[data-channel]"); const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
  if (!sibling) return;
  if (direction < 0) sibling.before(row); else sibling.after(row);
  renumberChannels(); markDirty(button.form); button.focus();
}
function movePreview(index, direction) {
  const pages = dialogContext.previewPages; const target = index + direction;
  if (target < 0 || target >= pages.length) return;
  [pages[index], pages[target]] = [pages[target], pages[index]];
  markDirty($("form", dialog));
  renderPreviewList(`[data-preview-move="${target}"][data-dir="${direction}"]:not(:disabled), [data-preview-move="${target}"]:not(:disabled)`);
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const d = button.dataset;
  if (d.tab) showTab(d.tab, d.focus);
  else if (d.add) openRecordEditor(d.add);
  else if (d.edit) { const item = list(state.tab).find((v) => (v.id ?? v.slug) === d.edit); if (item) openRecordEditor(state.tab, item); }
  else if (d.delete) confirmDelete(d.delete);
  else if (d.editPage) openPageEditor(d.editPage);
  else if (d.action === "menu") toggleMenu();
  else if (d.action === "password") { closeMenu(); openPasswordDialog(); }
  else if (d.action === "logout") logout();
  else if (d.action === "channel-add") { const holder = $("[data-channels]", app); holder.insertAdjacentHTML("beforeend", channelRow()); renumberChannels(); markDirty(button.form); holder.lastElementChild.querySelector("input")?.focus(); }
  else if (d.action === "channel-remove") { button.closest("[data-channel]").remove(); renumberChannels(); markDirty(button.form); $("[data-action=channel-add]", app).focus(); }
  else if (d.action === "channel-up") moveChannel(button, -1);
  else if (d.action === "channel-down") moveChannel(button, 1);
});
app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-search]")) { state.query = target.value; renderRows(); }
  else if (target.matches("[data-checklist-filter]")) refreshChecklist(target.closest("[data-checklist]"));
  else if (target.matches("[data-wa-field]")) updateWhatsapp(target);
  if (target.name && target.form) markDirty(target.form);
});
app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-show-password]")) togglePasswords(target);
  else if (target.closest("[data-checklist]") && target.type === "checkbox") refreshChecklist(target.closest("[data-checklist]"));
});
app.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("[data-checklist-filter], [data-search]")) event.preventDefault();
  if (event.key === "Escape" && $("#sidebar")?.classList.contains("is-open")) { closeMenu(); $(".menu-toggle")?.focus(); }
});
app.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "vitrin-form" || form.id === "site-form") {
    event.preventDefault();
    const data = new FormData(form);
    if (form.id === "vitrin-form") saveVitrin(form, data); else saveSite(form, data);
  }
});

dialog.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.matches("[data-close]")) requestClose();
  else if (target.dataset.imageRemove) setImage(target.form, target.dataset.imageRemove, "", null);
  else if (target.dataset.previewMove !== undefined) movePreview(Number(target.dataset.previewMove), Number(target.dataset.dir));
  else if (target.dataset.previewRemove !== undefined) {
    const index = Number(target.dataset.previewRemove);
    dialogContext.previewPages.splice(index, 1); markDirty(target.form);
    const left = dialogContext.previewPages.length;
    renderPreviewList(left ? `[data-preview-remove="${Math.min(index, left - 1)}"]` : "[data-preview-upload]");
  } else if (target.dataset.insert) {
    const field = target.form.elements.namedItem(dialogContext?.insertTarget ?? "body");
    field.setRangeText(target.dataset.insert, field.selectionStart, field.selectionEnd, "end"); field.focus(); markDirty(target.form);
  }
});
dialog.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-checklist-filter]")) refreshChecklist(target.closest("[data-checklist]"));
  else if (target.name === "description" && target.form) updateCharCount(target.form);
  if (target.name && target.form) markDirty(target.form);
});
dialog.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-upload]")) uploadImageField(target);
  else if (target.matches("[data-preview-upload]")) uploadPreviewPages(target);
  else if (target.matches("[data-show-password]")) togglePasswords(target);
  else if (target.closest("[data-checklist]") && target.type === "checkbox") refreshChecklist(target.closest("[data-checklist]"));
});
dialog.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("[data-checklist-filter]")) event.preventDefault();
});
dialog.addEventListener("focusin", (event) => {
  if (dialogContext?.insertTarget && event.target.matches("textarea[name=description], textarea[name=body]")) dialogContext.insertTarget = event.target.name;
});
dialog.addEventListener("cancel", (event) => { event.preventDefault(); requestClose(); });

/* ---------- Başlangıç ---------- */
try {
  const session = await api("session");
  if (session.authenticated) { state.csrfToken = session.csrfToken; await loadContent(); renderShell(); renderMain(); }
  else renderLogin();
} catch (error) { renderLogin(error.message); }
