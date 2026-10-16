const app = document.getElementById("admin-app");
const dialog = document.getElementById("editor");
const notification = document.getElementById("notification");
const base = location.pathname.replace(/yonetim\/?$/, "");
const state = { csrfToken: "", content: { books: [], authors: [], campaigns: [] }, tab: "overview", query: "", saving: false };
const labels = { books: "Kitaplar", authors: "Yazarlar", campaigns: "Ana sayfa duyuruları" };
const singular = { books: "Kitap", authors: "Yazar", campaigns: "Duyuru" };
let toastTimer;
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (value) => String(value).toLocaleLowerCase("tr").replace(/ı/g,"i").normalize("NFD").replace(/\p{M}/gu, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const split = (value) => String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const route = (path) => `${base}${path.replace(/^\//, "")}`;
function safeImage(value) {
  const candidate = String(value ?? "").replace(/^public\//, "/");
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return route(candidate);
  try { const url = new URL(candidate); return ["http:","https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
function toast(message) {
  notification.textContent = message; notification.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { notification.hidden = true; }, 7000);
}
async function api(path, options = {}) {
  let response;
  try { response = await fetch(route(`/api/admin/${path}`), { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", "X-CSRF-Token": state.csrfToken, ...options.headers } }); }
  catch { throw new Error("Yönetim sunucusuna ulaşılamadı. Sunucunun çalıştığını kontrol edin."); }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Bu adres yönetim API’sini sunmuyor. Proje klasöründe npm run cms komutuyla yönetim sunucusunu başlatın.");
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== "login") { dialog.close(); state.csrfToken = ""; renderLogin("Oturumunuz sona erdi. Tekrar giriş yapın."); }
    throw new Error(result.error || "İşlem tamamlanamadı.");
  }
  return result;
}
function renderLogin(error = "") {
  app.removeAttribute("aria-busy");
  app.innerHTML = `<div class="login-shell"><section class="login-intro"><a class="login-brand" href="${route("/")}">isl<span>am</span>bol <small>yayınları</small></a><p class="eyebrow">YAYINEVİ YÖNETİMİ</p><h1>Kitaplarınızın<br>yeni hikâyesi<br>burada başlıyor.</h1><p>Kitaplarınızı, yazarlarınızı ve ana sayfa duyurularınızı tek yerden yönetin.</p></section><section class="login-panel"><div class="login-card"><p class="eyebrow">İSLAMBOL YAYINLARI</p><h2>Yönetici girişi</h2><p class="muted">Yayınlarınızı düzenlemek için giriş yapın.</p><form id="login-form"><label class="field">Yönetici şifresi<input name="password" aria-describedby="login-error" type="password" autocomplete="current-password" required autofocus minlength="8"></label><p class="form-error" role="alert" id="login-error" ${error ? "" : "hidden"}>${escape(error)}</p><button class="button button-primary" type="submit">Giriş yap <span aria-hidden="true">→</span></button></form><div class="local-note">İlk kurulum şifresi <code>npm run cms</code> komutunun çalıştığı terminalde gösterilir.</div><p class="login-return"><a href="${route("/")}">← Siteye dön</a></p></div></section></div>`;
  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector("button"); const errorElement = document.getElementById("login-error");
    button.disabled = true; button.textContent = "Giriş yapılıyor…"; errorElement.hidden = true;
    try { const result = await api("login", { method: "POST", body: JSON.stringify({ password: new FormData(form).get("password") }) }); state.csrfToken = result.csrfToken; await loadContent(); render(); }
    catch (error) { errorElement.textContent = error.message; errorElement.hidden = false; }
    finally { button.disabled = false; button.textContent = "Giriş yap →"; }
  });
}
async function loadContent() { state.content = await api("content"); }
async function useSavedContent(result) {
  if (["books", "authors", "campaigns"].every((key) => Array.isArray(result[key]))) {
    state.content = { books: result.books, authors: result.authors, campaigns: result.campaigns };
    return;
  }
  // Saving already succeeded: a refresh failure must not invite a duplicate submission.
  try { await loadContent(); } catch (error) { toast(`Kayıt tamamlandı; liste yenilenemedi. ${error.message}`); }
}
function render() {
  app.removeAttribute("aria-busy");
  const counts = state.content;
  app.innerHTML = `<div class="admin-shell"><aside class="sidebar"><a href="${route("/")}" class="sidebar-brand">isl<span>am</span>bol</a><div class="sidebar-caption">YAYIN YÖNETİMİ</div><nav aria-label="Yönetim bölümleri"><button class="nav-item" data-tab="overview" ${state.tab === "overview" ? 'aria-current="page"' : ""}>Genel bakış</button>${Object.entries(labels).map(([key, label]) => `<button class="nav-item" data-tab="${key}" ${state.tab === key ? 'aria-current="page"' : ""}>${label}<span class="nav-count">${counts[key].length}</span></button>`).join("")}</nav><div class="sidebar-bottom"><a href="${route("/")}" target="_blank" rel="noopener">Siteyi görüntüle ↗</a><button class="logout" data-action="logout">Oturumu kapat</button></div></aside><div class="admin-content"><header class="admin-top"><span>İslambol Yayınları <span aria-hidden="true">/</span> ${state.tab === "overview" ? "Genel bakış" : labels[state.tab]}</span><span class="session-indicator">Yönetici <button class="logout" data-action="logout" aria-label="Oturumu kapat">· Çıkış</button></span></header><div class="admin-main">${state.tab === "overview" ? overview() : collection()}</div></div></div>`;
  app.querySelector("[data-search]")?.addEventListener("input", (event) => { state.query = event.target.value; renderRows(); });
}
function overview() {
  const c = state.content; const published = c.books.filter((b) => b.status !== "draft").length;
  return `<div class="page-heading"><div><p class="eyebrow">YAYINEVİNİZ BİR BAKIŞTA</p><h1>Hoş geldiniz.</h1><p>Kataloğunuz ve ana sayfanız sizin kontrolünüzde.</p></div><a class="button" href="${route("/")}" target="_blank" rel="noopener">Siteyi görüntüle ↗</a></div><div class="stats">${[["books","Kitap",c.books.length,`${published} yayında · ${c.books.length-published} taslak`],["authors","Yazar",c.authors.length,"Biyografiler ve eserler"],["campaigns","Duyuru",c.campaigns.length,`${c.campaigns.filter((v)=>v.active).length} aktif duyuru`]].map(([tab,label,number,info])=>`<button class="stat" data-tab="${tab}"><span class="stat-label">${label}</span><span class="stat-number">${number}</span><span class="stat-info">${info} →</span></button>`).join("")}</div><section class="welcome"><div><h2>Yeni bir kitap, yeni bir başlangıç.</h2><p>Yeni yayınınızı kataloğa ekleyin; ardından ana sayfada bir duyuruyla okurlarınıza tanıtın.</p></div><button class="button button-primary" data-add="books">+ Kitap ekle</button></section><div class="quick-actions">${[["books","Kitaplarınızı yönetin","Kapak, künye ve tanıtım metinlerini düzenleyin. Kitapları yayına alın veya taslak olarak saklayın."],["authors","Yazarlarınızı tanıtın","Portreleri ve biyografileri güncelleyin. Yazarları kitaplarıyla bir araya getirin."],["campaigns","Vitrininizi yenileyin","Yeni kitap reklamları ekleyin. Görselleri, bağlantıları ve ana sayfadaki sıralamayı değiştirin."]].map(([key,title,text])=>`<section class="quick-card"><h3>${title}</h3><p>${text}</p><button class="button button-small" data-tab="${key}">${labels[key]} →</button></section>`).join("")}</div><p class="deploy-note">Kaydettiğiniz içerik bu sunucudaki siteyi günceller. Ayrı bir GitHub Pages yayını kullanıyorsanız canlı site için yayınlama işlemi gerekir.</p>`;
}
function collection() {
  return `<div class="page-heading"><div><p class="eyebrow">İÇERİK YÖNETİMİ</p><h1>${labels[state.tab]}</h1><p>${{books:"Kataloğa kitap ekleyin, bilgileri güncelleyin ve yayın durumunu yönetin.",authors:"Yazarların portrelerini, biyografilerini ve eserlerini düzenleyin.",campaigns:"Site girişindeki duyuruları, reklam görsellerini ve sıralamayı yönetin."}[state.tab]}</p></div><button class="button button-primary" data-add="${state.tab}">+ ${singular[state.tab]} ekle</button></div><div class="content-card"><div class="table-tools"><input class="search-input" data-search type="search" value="${escape(state.query)}" placeholder="${singular[state.tab]} ara…" aria-label="${singular[state.tab]} ara"><span class="table-count" data-table-count></span></div><div class="table-scroll"><table><thead><tr><th>${singular[state.tab].toLocaleUpperCase("tr")}</th><th>${state.tab === "campaigns" ? "SIRA" : state.tab === "authors" ? "KİTAP" : "YAZAR"}</th><th>DURUM</th><th class="align-right">İŞLEMLER</th></tr></thead><tbody id="records">${rows()}</tbody></table></div></div>`;
}
function filteredRecords() {
  const query = state.query.toLocaleLowerCase("tr");
  return state.content[state.tab].filter((item)=>`${item.title??item.display??item.name} ${item.author_display??""} ${item.isbn??""}`.toLocaleLowerCase("tr").includes(query));
}
function rows() {
  const records = filteredRecords();
  if (!records.length) return `<tr><td colspan="4" class="empty">${state.query ? "Aramanızla eşleşen kayıt bulunamadı." : "Henüz kayıt yok. İlk kaydınızı ekleyebilirsiniz."}</td></tr>`;
  return records.map((item)=> {
    const id = item.id ?? item.slug; const author = state.tab === "authors"; const campaign = state.tab === "campaigns";
    const image = safeImage(author ? item.photo_url : campaign ? item.image_url : item.cover?.local_path);
    const status = campaign ? item.active : author ? true : item.status !== "draft";
    const title = item.title ?? item.display ?? item.name;
    const thumbnail = image ? `<img class="record-thumb${author ? " record-thumb-author" : campaign ? " record-thumb-campaign" : ""}" src="${escape(image)}" alt="" loading="lazy">` : author ? `<span class="initial-avatar" aria-hidden="true">${escape(item.name.split(" ").slice(0,2).map((v)=>v[0]).join(""))}</span>` : "";
    const books = author ? state.content.books.filter((b)=>b.authors?.includes(item.name)||item.book_ids?.includes(b.id)).length : 0;
    return `<tr><td><div class="record-title">${thumbnail}<div><strong>${escape(title)}</strong><small>${escape(author ? item.slug : campaign ? item.eyebrow : item.isbn || item.id)}</small></div></div></td><td>${escape(campaign ? item.order : author ? `${books} kitap` : item.author_display || item.authors?.join(", ") || "—")}</td><td><span class="badge${status ? "" : " badge-draft"}">${author ? "Kayıtlı" : status ? campaign ? "Aktif" : "Yayında" : campaign ? "Pasif" : "Taslak"}</span></td><td><div class="row-actions"><button class="button button-small" data-edit="${escape(id)}" aria-label="${escape(title)} düzenle">Düzenle</button><button class="button button-small button-danger" data-delete="${escape(id)}" aria-label="${escape(title)} sil">Sil</button></div></td></tr>`;
  }).join("");
}
function renderRows() { document.getElementById("records").innerHTML = rows(); updateCount(); }
function updateCount() { const element = app.querySelector("[data-table-count]"); if (element) element.textContent = `${filteredRecords().length} kayıt`; }
const input = (label,name,value="",options={}) => `<label class="field${options.wide?" field-wide":""}">${label}<input name="${name}" value="${escape(value)}" type="${options.type||"text"}" ${options.required?"required":""} ${options.readonly?"readonly":""} ${options.min!==undefined?`min="${options.min}"`:""} ${options.max!==undefined?`max="${options.max}"`:""} ${options.maxlength?`maxlength="${options.maxlength}"`:""} ${options.placeholder?`placeholder="${escape(options.placeholder)}"`:""}>${options.help?`<small>${options.help}</small>`:""}</label>`;
const textarea = (label,name,value="") => `<label class="field field-wide">${label}<textarea name="${name}">${escape(value)}</textarea></label>`;
const select = (label,name,value,values) => `<label class="field">${label}<select name="${name}">${values.map(([v,l])=>`<option value="${v}" ${String(value)===v?"selected":""}>${l}</option>`).join("")}</select></label>`;
function uploadField(label,name,value,help) {
  const image = safeImage(value);
  return `<div class="field field-wide">${label}<div class="upload-field"><img class="upload-preview" data-preview="${name}" ${image?`src="${escape(image)}"`:"hidden"} alt="Seçili görsel"><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${name}" aria-label="${label} yükle"><label class="field">Görsel yolu<input name="${name}" value="${escape(value)}" placeholder="${name === "cover_path" ? "public/uploads/gorsel.webp" : "/uploads/gorsel.webp"}"></label><small>${help} PNG, JPEG veya WebP; en fazla 8 MB.</small></div></div>`;
}
function bookFields(item,editing) {
  return `${input("Kitap adı","title",item.title,{required:true,maxlength:300})}${input("Kayıt adresi","id",item.id,{required:true,readonly:editing,help:"Kitap adı yazılınca otomatik oluşur. Küçük harf ve tire kullanın."})}${input("Alt başlık","subtitle",item.subtitle)}${select("Yayın durumu","status",item.status||"published",[["published","Yayında"],["draft","Taslak"]])}${input("Yazarlar","authors",item.authors?.join(", "),{help:"Birden fazla yazarı virgülle ayırın."})}${input("Yazar gösterimi","author_display",item.author_display,{placeholder:"Örn. Prof. Dr. Ali Seyyar"})}${input("ISBN","isbn",item.isbn,{maxlength:17})}${input("Sayfa sayısı","pages",item.pages,{type:"number",min:1})}${input("Yayın tarihi","publish_date",item.publish_date,{placeholder:"2026, 2026-10 veya 2026-10-14"})}${input("Kategoriler","categories",item.categories?.join(", "),{help:"Virgülle ayırın: Tarih, Araştırma - İnceleme, İslam"})}${uploadField("Kitap kapağı","cover_path",item.cover?.local_path,"Dikey kitap kapağı önerilir.")}${textarea("Tanıtım metni","description",item.description)}${input("Boyutlar","dimensions",item.dimensions,{placeholder:"13,5 × 21 cm"})}${input("Kapak / cilt türü","binding",item.binding,{placeholder:"Karton Kapak"})}${input("Dizi / seri","series",item.series)}<label class="checkbox-field"><input type="checkbox" name="is_set" ${item.is_set?"checked":""}>Set veya takım kitap</label><h3 class="form-section">Satış bağlantıları</h3>${input("Kitapyurdu","source_kitapyurdu",item.sources?.kitapyurdu,{type:"url"})}${input("Küresel Kitap","source_kureselkitap",item.sources?.kureselkitap,{type:"url"})}${input("Nobel Kitap","source_nobelkitap",item.sources?.nobelkitap,{type:"url",wide:true})}`;
}
function authorFields(item,editing) {
  return `${input("Yazar adı","name",item.name,{required:true,maxlength:200})}${input("Kayıt adresi","slug",item.slug,{required:true,readonly:editing})}${input("Sitede görünen adı","display",item.display,{wide:true,help:"Unvan eklemek için kullanabilirsiniz."})}${uploadField("Yazar portresi","photo_url",item.photo_url,"Kare ve yüzün ortada olduğu bir fotoğraf önerilir.")}${textarea("Biyografi","bio",item.bio)}<label class="field field-wide">İlişkili kitaplar<select name="book_ids" multiple>${state.content.books.map((b)=>`<option value="${escape(b.id)}" ${item.book_ids?.includes(b.id)?"selected":""}>${escape(b.title)}</option>`).join("")}</select><small>Birden fazla seçim için Ctrl / Cmd tuşunu kullanın. Kitabın yazar alanı da ilişkiyi otomatik kurar.</small></label>`;
}
function campaignFields(item,editing) {
  return `${input("Duyuru başlığı","title",item.title,{required:true,maxlength:300})}${input("Kayıt adresi","id",item.id,{required:true,readonly:editing})}${input("Üst etiket","eyebrow",item.eyebrow,{placeholder:"Yeni kitap / Okuma seçkisi"})}${input("Gösterim sırası","order",item.order??0,{type:"number",min:0,max:9999})}${textarea("Kısa açıklama","description",item.description)}${uploadField("Reklam görseli","image_url",item.image_url,"Yatay görsel önerilir. Boş bırakırsanız seçilen kitap kapağı gösterilir.")}<label class="field">İlişkili kitap<select name="book_id"><option value="">Kitap seçin (isteğe bağlı)</option>${state.content.books.filter((b)=>b.status!=="draft").map((b)=>`<option value="${escape(b.id)}" ${item.book_id===b.id?"selected":""}>${escape(b.title)}</option>`).join("")}</select></label>${select("Arka plan rengi","theme",item.theme||"peach",[["peach","Şeftali"],["sage","Adaçayı"],["cream","Krem"]])}${input("Buton yazısı","button_label",item.button_label||"Kitabı incele")}${input("Hedef bağlantı","link_url",item.link_url,{placeholder:"/kitaplar/ veya https://…",help:"Boş bırakırsanız seçilen kitaba yönlendirir."})}<label class="checkbox-field field-wide"><input type="checkbox" name="active" ${item.active!==false?"checked":""}>Ana sayfada göster</label>`;
}
function openEditor(resource,item={}) {
  const editing = Boolean(item.id || item.slug);
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="editor-title">${singular[resource]} ${editing?"düzenle":"ekle"}</h2><button class="close-dialog" data-close aria-label="Pencereyi kapat">×</button></div><form id="record-form"><div class="editor-body"><p class="form-error" role="alert" data-form-error hidden></p><fieldset><div class="editor-grid">${resource==="books"?bookFields(item,editing):resource==="authors"?authorFields(item,editing):campaignFields(item,editing)}</div></fieldset></div><div class="editor-footer"><span class="save-status" aria-live="polite"></span><button class="button" type="button" data-close>Vazgeç</button><button class="button button-primary" type="submit">${editing?"Değişiklikleri kaydet":"Kaydet"}</button></div></form>`;
  const form = document.getElementById("record-form");
  if (!editing) {
    const source = form.elements.namedItem(resource==="authors"?"name":"title"); const target = form.elements.namedItem(resource==="authors"?"slug":"id"); let custom=false;
    target.addEventListener("input",()=>{custom=Boolean(target.value);}); source.addEventListener("input",()=>{if(!custom)target.value=slug(source.value);});
  }
  dialog.querySelectorAll("[data-upload]").forEach((fileInput)=>fileInput.addEventListener("change",()=>upload(fileInput,form)));
  dialog.querySelectorAll(".upload-field input:not([type=file])").forEach((field)=>field.addEventListener("change",()=>{const preview=dialog.querySelector(`[data-preview="${field.name}"]`);const url=safeImage(field.value);preview.hidden=!url;if(url)preview.src=url;}));
  form.addEventListener("submit",async(event)=> {
    event.preventDefault(); if(state.saving)return;
    const data=new FormData(form); const value=(name)=>String(data.get(name)??"").trim();
    let body;
    if(resource==="books")body={...item,id:value("id"),title:value("title"),subtitle:value("subtitle")||null,authors:split(value("authors")),author_display:value("author_display")||split(value("authors")).join(", ")||null,isbn:value("isbn")||null,pages:value("pages")?Number(value("pages")):null,publish_date:value("publish_date")||null,categories:split(value("categories")),description:value("description"),status:value("status"),dimensions:value("dimensions")||null,binding:value("binding")||null,series:value("series")||null,is_set:data.has("is_set"),cover:{...item.cover,local_path:value("cover_path")||null},sources:{...item.sources,kitapyurdu:value("source_kitapyurdu")||null,kureselkitap:value("source_kureselkitap")||null,nobelkitap:value("source_nobelkitap")||null}};
    else if(resource==="authors")body={...item,name:value("name"),slug:value("slug"),display:value("display")||value("name"),bio:value("bio")||null,photo_url:value("photo_url")||null,book_ids:data.getAll("book_ids")};
    else body={...item,id:value("id"),title:value("title"),eyebrow:value("eyebrow"),description:value("description"),image_url:value("image_url")||null,book_id:value("book_id")||null,link_url:value("link_url")||null,button_label:value("button_label"),order:Number(value("order")),theme:value("theme"),active:data.has("active")};
    setSaving(form,true); const errorElement=form.querySelector("[data-form-error]");errorElement.hidden=true;
    try {const result=await api(`${resource}${editing?`/${encodeURIComponent(item.id??item.slug)}`:""}`,{method:editing?"PUT":"POST",body:JSON.stringify(body)});await useSavedContent(result);dialog.close();state.tab=resource;render();updateCount();toast(`${singular[resource]} kaydedildi. Site güncellendi.`);}
    catch(error){errorElement.textContent=error.message;errorElement.hidden=false;errorElement.scrollIntoView({block:"nearest"});}
    finally{setSaving(form,false);}
  });
  dialog.showModal(); form.querySelector("input")?.focus();
}
function setSaving(form,busy) {
  state.saving=busy;form.querySelector("fieldset").disabled=busy;form.querySelectorAll("button").forEach((b)=>{b.disabled=busy;});dialog.querySelector(".close-dialog").disabled=busy;form.querySelector(".save-status").textContent=busy?"Kaydediliyor ve site güncelleniyor…":"";
}
async function upload(fileInput,form) {
  const file=fileInput.files?.[0];if(!file)return;
  const errorElement=form.querySelector("[data-form-error]");errorElement.hidden=true;
  if(file.size>8*1024*1024){errorElement.textContent="Görsel 8 MB’dan küçük olmalıdır.";errorElement.hidden=false;fileInput.value="";return;}
  setSaving(form,true);
  try {
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Görsel okunamadı."));reader.readAsDataURL(file);});
    const result=await api("upload",{method:"POST",body:JSON.stringify({filename:file.name,data})});const name=fileInput.dataset.upload;form.elements.namedItem(name).value=name==="cover_path"?result.local_path:result.url;const preview=dialog.querySelector(`[data-preview="${name}"]`);preview.src=safeImage(result.url);preview.hidden=false;
  }catch(error){errorElement.textContent=error.message;errorElement.hidden=false;}finally{setSaving(form,false);fileInput.value="";}
}
function confirmDelete(id) {
  const resource=state.tab; const item=state.content[resource].find((record)=>(record.id??record.slug)===id);if(!item)return;
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="editor-title">${singular[resource]} silinsin mi?</h2><button class="close-dialog" data-close aria-label="Pencereyi kapat">×</button></div><div class="confirmation-body"><h3>${escape(item.title??item.display??item.name)}</h3><p>${resource==="books"?"Kitap katalogdan ve ana sayfa seçkilerinden kaldırılacak. Kitabı saklamak isterseniz yayın durumunu Taslak olarak değiştirebilirsiniz.":resource==="authors"?"Yazar profili kaldırılacak. Kitaplar katalogda kalacak.":"Duyuru ana sayfadan ve yönetim listesinden kaldırılacak."}</p><p class="form-error" role="alert" data-delete-error hidden></p></div><div class="editor-footer"><button class="button" data-close>Vazgeç</button><button class="button button-danger" data-confirm-delete>Sil</button></div>`;
  dialog.querySelector("[data-confirm-delete]").addEventListener("click",async(event)=>{state.saving=true;dialog.querySelectorAll("button").forEach((b)=>{b.disabled=true;});event.currentTarget.textContent="Siliniyor…";try{const result=await api(`${resource}/${encodeURIComponent(id)}`,{method:"DELETE"});await useSavedContent(result);dialog.close();render();updateCount();toast(`${singular[resource]} kaldırıldı. Site güncellendi.`);}catch(error){const e=dialog.querySelector("[data-delete-error]");e.textContent=error.message;e.hidden=false;}finally{state.saving=false;dialog.querySelectorAll("button").forEach((b)=>{b.disabled=false;});const b=dialog.querySelector("[data-confirm-delete]");if(b)b.textContent="Sil";}});
  dialog.showModal();
}
app.addEventListener("click",async(event)=> {
  const button=event.target.closest("button");if(!button)return;
  if(button.dataset.tab){state.tab=button.dataset.tab;state.query="";render();updateCount();}
  else if(button.dataset.add)openEditor(button.dataset.add);
  else if(button.dataset.edit){const item=state.content[state.tab].find((v)=>(v.id??v.slug)===button.dataset.edit);if(item)openEditor(state.tab,item);}
  else if(button.dataset.delete)confirmDelete(button.dataset.delete);
  else if(button.dataset.action==="logout"){try{await api("logout",{method:"POST",body:"{}"});state.csrfToken="";state.content={books:[],authors:[],campaigns:[]};renderLogin();}catch(error){toast(error.message);}}
});
dialog.addEventListener("click",(event)=>{if(event.target.closest("[data-close]")&&!state.saving)dialog.close();});
dialog.addEventListener("cancel",(event)=>{if(state.saving)event.preventDefault();});
try {const session=await api("session");if(session.authenticated){state.csrfToken=session.csrfToken;await loadContent();render();updateCount();}else renderLogin();}catch(error){renderLogin(error.message);}


