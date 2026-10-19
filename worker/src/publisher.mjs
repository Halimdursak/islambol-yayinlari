// "Yayınla": taslakları tek bir commit olarak GitHub main dalına gönderir, ardından GitHub Pages dağıtımını izler.
// Tüm adımlar kalıcı bir iş kaydı (job) üzerinden ilerler ve istek başına alt istek sınırını aşmamak için sürdürülebilir:
// bir adım bütçeyi bitirirse iş "working" kalır ve panelin yoklaması (GET /publish) kaldığı yerden devam ettirir.
import { CmsError } from "../../scripts/cms/content.mjs";
import { FILES } from "../../scripts/cms/mutations.mjs";
import { PANEL_PREFIX, UPLOADS_DIR, describeChanges, diffBooks, uploadRefs } from "../../scripts/cms/publish-core.mjs";
import { BudgetExhausted } from "./github.mjs";
import { mapLimit } from "./lock.mjs";

const MAX_WAIT_MS = 8 * 60 * 1000;
const CHECK_EVERY_MS = 3000;
const BACKUPS_KEPT = 10;
const JOB_KEY = "job";
const IDLE = { phase: "idle", message: "", detail: "", url: null, finishedAt: null };

const parseBooks = (text) => { try { return JSON.parse(text ?? "[]"); } catch { return []; } };

/** Ham hata → kullanıcıya gösterilecek sade cümle (+ teknik ayrıntı). */
function explain(error) {
  if (error instanceof CmsError) return { message: error.message, detail: error.detail ?? "" };
  return { message: "Yayınlama tamamlanamadı. Değişiklikleriniz panelde duruyor; tekrar deneyebilir ya da siteyi hazırlayan kişiye bildirebilirsiniz.", detail: String(error?.message ?? error).slice(-1500) };
}

export function createPublisher({ storage, github, store, siteUrl = "https://islambol.org", now = Date.now }) {
  let job = null;

  async function loadJob() { if (!job) job = (await storage.get(JOB_KEY)) ?? { ...IDLE }; return job; }
  async function saveJob(next) { job = next; await storage.put(JOB_KEY, job); }
  const running = () => job?.phase === "working" || job?.phase === "waiting";
  const publicJob = () => { const { work, sha, checkedAt, waitStartedAt, ...rest } = job ?? IDLE; return rest; };

  /** Yayınlanacakları hesaplar: değişen dosyalar, eklenecek yüklemeler, özet ve çakışmalar. */
  async function plan() {
    const live = await store.refreshLive();
    const drafts = await store.listDrafts();
    const conflicts = drafts.filter((draft) => draft.conflict).map((draft) => draft.path);
    const have = new Set(live.uploads);
    const uploads = [];
    const missing = [];
    for (const path of uploadRefs(await store.allTexts())) {
      const name = path.slice(UPLOADS_DIR.length + 1);
      if (have.has(name)) continue;
      (await store.hasUpload(name) ? uploads : missing).push(name);
    }
    const booksDraft = drafts.find((draft) => draft.path === FILES.books);
    const summary = booksDraft ? diffBooks(parseBooks(await store.liveText(FILES.books)), parseBooks(booksDraft.text)) : { added: [], changed: [], removed: [] };
    summary.other = drafts.some((draft) => draft.path !== FILES.books) ? 1 : 0;
    const text = describeChanges(summary) || (drafts.length ? "kitap bilgileri" : "");
    return { live, drafts, conflicts, uploads, missing, summary, text };
  }

  /** Panelin üst çubuğu için durum. Sürmekte olan işi de bir adım ilerletir. */
  async function changes() {
    await loadJob();
    if (job.phase === "working") await advance();
    else if (job.phase === "waiting") await checkDeploy();
    const current = await plan();
    return {
      configured: true, pending: current.drafts.length > 0, files: current.drafts.length, unpushed: 0, foreign: [], foreignCount: 0,
      conflicts: current.conflicts, summary: current.summary, text: current.text, running: running(), job: publicJob(),
    };
  }

  async function start() {
    await loadJob();
    if (running()) return { started: false, reason: "Bir yayın zaten sürüyor." };
    const current = await plan();
    if (current.conflicts.length) throw new CmsError(409, "GitHub'daki içerik siz çalışırken başka bir yerden değişmiş ve değişikliklerinizle çakışıyor. “Geri al” ile son yayınlanan haline dönüp değişikliklerinizi yeniden yapın.");
    if (current.missing.length) throw new CmsError(409, "Bir görsel bulunamadı; kitabı açıp görseli yeniden yükleyin.");
    if (!current.drafts.length) {
      await saveJob({ ...IDLE, phase: "done", message: "Yayınlanacak yeni değişiklik yok; site güncel.", finishedAt: now() });
      return { started: true };
    }
    await saveJob({
      ...IDLE, phase: "working", message: "Değişiklikler hazırlanıyor…",
      work: { baseSha: current.live.sha, baseTree: current.live.tree, text: current.text, files: current.drafts.map(({ path, text }) => ({ path, text })), uploads: current.uploads.map((name) => ({ name })) },
    });
    await advance();
    return { started: true };
  }

  /** Blob'ları oluşturur, ağaç + commit yazar, main'i ilerletir. Alt istek bütçesi bitince durur ve sonra devam eder. */
  async function advance() {
    if (job?.phase !== "working") return;
    const work = job.work;
    try {
      const pending = [...work.files.filter((file) => !file.sha), ...work.uploads.filter((upload) => !upload.sha)];
      await mapLimit(pending, 3, async (item) => {
        if (item.text !== undefined) { item.sha = await github.createBlob({ text: item.text }); return; }
        const record = await store.getUpload(item.name);
        if (!record) throw new CmsError(409, "Bir görsel bulunamadı; kitabı açıp görseli yeniden yükleyin.");
        item.sha = await github.createBlob({ bytes: new Uint8Array(record.data) });
      });
      if (github.remaining < 4) { await saveJob({ ...job, work, message: "Görseller GitHub'a aktarılıyor…" }); return; }
      const entries = [...work.files.map((file) => ({ path: file.path, sha: file.sha })), ...work.uploads.map((upload) => ({ path: `${UPLOADS_DIR}/${upload.name}`, sha: upload.sha }))];
      const tree = await github.createTree(work.baseTree, entries);
      const commit = await github.createCommit({ message: `${PANEL_PREFIX} (${work.text || "içerik güncellemesi"})`, tree, parent: work.baseSha });
      const { moved } = await github.moveBranch("main", commit);
      if (moved) {
        await store.invalidateLive();
        throw new CmsError(409, "GitHub'da siz yayınlarken başka bir değişiklik yapıldı. Hiçbir şey kaybolmadı; “Tekrar dene”ye basın.");
      }
      await store.markPublished({ commit, tree, files: work.files, uploads: work.uploads.map((upload) => upload.name) });
      await saveJob({ ...IDLE, phase: "waiting", message: "GitHub'a gönderildi. Site güncelleniyor…", sha: commit, waitStartedAt: now(), checkedAt: 0 });
    } catch (error) {
      if (error instanceof BudgetExhausted) { await saveJob({ ...job, work, message: "Görseller GitHub'a aktarılıyor…" }); return; }
      const { message, detail } = explain(error);
      await saveJob({ ...IDLE, phase: "error", message, detail, finishedAt: now() });
    }
  }

  /** GitHub Actions bu commit için bitene kadar bekler; ilerlemeyi panelin yoklaması sürdürür. */
  async function checkDeploy() {
    if (job?.phase !== "waiting") return;
    if (now() - job.checkedAt < CHECK_EVERY_MS) return;
    job = { ...job, checkedAt: now() };
    let runs;
    try { runs = await github.runs(job.sha); }
    catch { await saveJob({ ...IDLE, phase: "done", message: "Gönderildi. Site 1–3 dakika içinde güncellenir.", url: siteUrl, finishedAt: now() }); return; }
    const failed = runs.some((run) => run.status === "completed" && run.conclusion && !["success", "skipped", "neutral"].includes(run.conclusion));
    if (failed) {
      await saveJob({ ...IDLE, phase: "error", message: "Değişiklikler GitHub'a gönderildi ama site güncellemesi başarısız oldu. Siteyi hazırlayan kişiye bildirin.", detail: runs.map((run) => `${run.name}: ${run.status}/${run.conclusion}`).join("; "), finishedAt: now() });
      return;
    }
    if (runs.length && runs.every((run) => run.status === "completed")) {
      await saveJob({ ...IDLE, phase: "done", message: "Yayında. Değişiklikler sitede görünüyor.", url: siteUrl, finishedAt: now() });
      await store.collectUploads(uploadRefs(await store.allTexts()));
      return;
    }
    if (now() - job.waitStartedAt > MAX_WAIT_MS) {
      await saveJob({ ...IDLE, phase: "done", message: "Gönderildi; site güncellemesi beklenenden uzun sürüyor. Birkaç dakika sonra siteyi yenileyin.", url: siteUrl, finishedAt: now() });
      return;
    }
    await saveJob({ ...job, message: runs.length ? "Site güncelleniyor… (genellikle 1–2 dakika)" : "GitHub yayın işini başlatıyor…" });
  }

  /** Henüz yayınlanmamış tüm değişiklikleri atar (önce bir yedeğini saklar). */
  async function discard() {
    await loadJob();
    if (running()) throw new CmsError(409, "Yayın sürerken değişiklikler geri alınamaz.");
    const drafts = await store.listDrafts();
    if (!drafts.length) throw new CmsError(409, "Geri alınacak, henüz yayınlanmamış bir değişiklik yok.");
    await storage.put(`backup:${String(now()).padStart(15, "0")}`, drafts);
    const backups = [...(await storage.list({ prefix: "backup:" })).keys()].sort();
    for (const key of backups.slice(0, Math.max(0, backups.length - BACKUPS_KEPT))) await storage.delete(key);
    await store.clearDrafts();
    await saveJob({ ...IDLE });
  }

  return { changes, start, advance, checkDeploy, discard, plan, running, loadJob };
}
