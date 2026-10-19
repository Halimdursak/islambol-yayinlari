/* Yönetim paneli: üstteki "Yayınla" çubuğu. Bekleyen değişiklikleri gösterir, tek tuşla internetteki siteyi günceller, ilerlemeyi izler. */
const POLL_MS = 1800;

export function createPublishBar(host) {
  const { escape } = host;
  let info = null;            // sunucudan gelen son durum
  let timer = null;
  let announced = "";         // aynı mesajı gereksiz yere yeniden yazmamak için (yazı alanı her sayfa çiziminde yeniden oluşur: html() sıfırlar)
  let lastActions = "";       // düğmeler değişmedikçe yerinde kalır (klavye odağı kaybolmasın)

  const html = () => { announced = ""; lastActions = ""; return `<div class="publish-bar" data-publish-bar role="region" aria-label="Yayın durumu"><div class="publish-text" data-publish-text aria-live="polite"></div><div class="publish-actions" data-publish-actions></div></div>`; };

  function paint() {
    const bar = document.querySelector("[data-publish-bar]");
    if (!bar || !info) { if (bar) bar.querySelector("[data-publish-text]").textContent = "Yayın durumu okunuyor…"; return; }
    const text = bar.querySelector("[data-publish-text]");
    const actions = bar.querySelector("[data-publish-actions]");
    const job = info.job ?? { phase: "idle", message: "" };
    bar.dataset.state = !info.configured ? "off" : info.running ? "busy" : job.phase === "error" ? "error" : info.pending ? "pending" : "clean";
    let message = "";
    let buttons = "";
    if (!info.configured) {
      message = `<span class="dot dot-off" aria-hidden="true"></span><span><strong>Yayınlama bu bilgisayarda kurulu değil.</strong> Değişiklikler yalnız yerel sitede görünür. <small>${escape(info.reason ?? "")}</small></span>`;
    } else if (info.running) {
      message = `<span class="spinner" aria-hidden="true"></span><span><strong>${escape(job.message || "Yayınlanıyor…")}</strong> <small>${host.state.mode === "cloud" ? "Birkaç dakika sürebilir." : "Bu pencereyi kapatmayın."}</small></span>`;
      buttons = '<button type="button" class="button button-primary" disabled>Yayınlanıyor…</button>';
    } else if (job.phase === "error") {
      message = `<span class="dot dot-error" aria-hidden="true"></span><span><strong>Yayınlanamadı.</strong> ${escape(job.message)}${job.detail ? `<details class="publish-detail"><summary>Teknik ayrıntı</summary><pre>${escape(job.detail)}</pre></details>` : ""}</span>`;
      buttons = '<button type="button" class="button button-primary" data-publish-start>Tekrar dene</button>';
    } else if (info.conflicts?.length) {
      message = `<span class="dot dot-error" aria-hidden="true"></span><span><strong>Yayınlanamıyor: içerik başka yerden değişmiş.</strong> GitHub'daki dosyalar siz çalışırken değiştirilmiş ve değişikliklerinizle çakışıyor. “Geri al”a basıp son yayınlanan halden yeniden başlayın. <small>Bekleyen: ${escape(info.text || "güncelleme")}.</small></span>`;
      buttons = '<button type="button" class="button button-primary" data-publish-discard>Geri al</button>';
    } else if (info.pending) {
      message = `<span class="dot dot-pending" aria-hidden="true"></span><span><strong>Yayınlanmayı bekleyen değişiklik var:</strong> ${escape(info.text || "güncelleme")}. <small>Henüz internetteki sitede görünmüyor.</small></span>`;
      buttons = `${info.files > 0 ? '<button type="button" class="button button-small" data-publish-discard>Geri al</button>' : ""}<button type="button" class="button button-primary" data-publish-start>Yayınla</button>`;
    } else if (job.phase === "done" && job.finishedAt && Date.now() - job.finishedAt < 10 * 60 * 1000) {
      message = `<span class="dot dot-ok" aria-hidden="true"></span><span><strong>${escape(job.message)}</strong>${job.url ? ` <a href="${escape(job.url)}" target="_blank" rel="noopener">Siteyi aç ↗</a>` : ""}</span>`;
      buttons = '<button type="button" class="button" disabled>Yayınla</button>';
    } else {
      message = '<span class="dot dot-ok" aria-hidden="true"></span><span><strong>Site güncel.</strong> <small>Bekleyen değişiklik yok.</small></span>';
      buttons = '<button type="button" class="button" disabled>Yayınla</button>';
    }
    if (info.configured && !info.running && info.foreignCount) message += `<small class="publish-foreign"> Not: bu bilgisayarda panelle ilgisiz ${info.foreignCount} gönderilmemiş değişiklik daha var.</small>`;
    if (announced !== message) { text.innerHTML = message; announced = message; }
    if (lastActions !== buttons) { actions.innerHTML = buttons; lastActions = buttons; }
  }

  async function refresh() {
    try { info = await host.api("publish"); }
    catch (error) { info = { configured: false, reason: error.message, job: { phase: "idle" } }; }
    paint();
    if (info.running && !timer) poll();
  }

  function poll() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      await refresh();
      if (info?.running) poll();
      else if (info?.job?.phase === "done") host.toast(info.job.message);
    }, POLL_MS);
  }

  async function start(confirmForeign = false, confirmHead) {
    if (info?.running) return;
    let result;
    const before = info;
    info = { ...(info ?? {}), configured: true, running: true, job: { phase: "working", message: "Yayınlama başlıyor…" } };
    paint();
    try {
      result = await host.api("publish", { method: "POST", body: JSON.stringify({ confirmForeign, confirmHead }) });
    } catch (error) { info = before; paint(); host.toast(error.message, "error"); return; }
    info = result;
    if (result.needsConfirm) { paint(); confirmForeignDialog(result); return; }
    paint();
    poll();
  }

  /** Panelle ilgisiz, bu bilgisayarda gönderilmemiş commit'ler varsa Yayınla bunları da yollar: önce sorulur. */
  function confirmForeignDialog(result) {
    const items = (result.foreign ?? []).map((t) => `<li>${escape(t)}</li>`).join("");
    const more = result.foreignCount > (result.foreign?.length ?? 0) ? `<li>… ve ${result.foreignCount - result.foreign.length} tane daha</li>` : "";
    host.openDialog({
      title: "Başka değişiklikler de gönderilecek", size: "narrow", plain: true, submit: "Evet, hepsini yayınla",
      body: `<div class="confirmation-body"><h3>Bu bilgisayarda panelden yapılmamış değişiklikler var</h3><p>“Yayınla” bunları da internetteki siteye ve herkese açık GitHub deposuna gönderir:</p><ul class="foreign-list">${items}${more}</ul><p>Emin değilseniz “Vazgeç”e basın ve siteyi hazırlayan kişiye sorun.</p></div>`,
      onSubmit: async () => { host.closeDialog(); await start(true, result.head); },
    });
  }

  function discard() {
    host.openDialog({
      title: "Değişiklikler geri alınsın mı?", size: "narrow", plain: true, danger: true, submit: "Evet, geri al",
      body: `<div class="confirmation-body"><h3>Son yayınlanan hale dönülecek</h3><p>Yayınlanmayı bekleyen değişiklikler (${escape(info?.text || "yeni kitaplar, düzenlemeler")}) silinir. İnternetteki site etkilenmez.</p><p>Bu işlem geri alınamaz.</p></div>`,
      onSubmit: (form) => host.guarded(form, "Geri alınıyor ve site yeniden hazırlanıyor…", async () => {
        try {
          const result = await host.api("publish/discard", { method: "POST", body: "{}" });
          await host.syncContent(result);
          info = { ...info, ...result };
          host.closeDialog();
          host.renderMain();
          host.toast("Değişiklikler geri alındı.");
        } catch (error) { host.showError(form, error.message); }
      }),
    });
  }

  function onClick(event) {
    const button = event.target.closest("button");
    if (!button) return false;
    if (button.matches("[data-publish-start]")) { start(false); return true; }
    if (button.matches("[data-publish-discard]")) { discard(); return true; }
    return false;
  }

  return { html, paint, refresh, start, onClick };
}
