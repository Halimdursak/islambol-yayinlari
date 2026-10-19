// "Yayınla" düğmesi: panelin değiştirdiği içerik dosyalarını git'e işler, GitHub'a gönderir ve GitHub Pages'in güncellenmesini bekler.
// Güvenlik: komutlar kabuksuz (spawn, sabit argüman dizisi, --literal-pathspecs); kullanıcı metni hiçbir komuta karışmaz;
// yalnız aşağıdaki içerik yolları ve içerikte gerçekten kullanılan yüklemeler işlenir.
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { containedPath } from "./paths.mjs";
import { CONTENT_PATHS, PANEL_PREFIX, PANEL_UPLOAD, UPLOADS_DIR, describeChanges, diffBooks, uploadRefs } from "./publish-core.mjs";

export { CONTENT_PATHS, UPLOADS_DIR, describeChanges, diffBooks, uploadRefs };

const BRANCH = "main";
const GH_HELPER = ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"];
const MAX_OUTPUT = 50_000_000;

/** Kabuksuz komut çalıştırıcı; testlerde yerine sahte bir çalıştırıcı verilir. */
export function defaultRun(file, args, { cwd, timeout = 120000 } = {}) {
  return new Promise((done) => {
    let child;
    try { child = spawn(file, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", LC_ALL: "C" } }); }
    catch (error) { done({ code: 127, stdout: "", stderr: String(error.message) }); return; }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); stderr += "\n[zaman aşımı]"; }, timeout);
    child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-MAX_OUTPUT); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-20000); });
    child.on("error", (error) => { clearTimeout(timer); done({ code: 127, stdout, stderr: stderr + String(error.message) }); });
    child.on("close", (code) => { clearTimeout(timer); done({ code: code ?? 1, stdout, stderr }); });
  });
}

/** Git/GitHub hatasını sade Türkçe cümleye çevirir; ham çıktı "ayrıntı" olarak ayrıca tutulur. Giriş hataları ağ hatasından önce denetlenir (403 metni "unable to access" içerir). */
export function friendlyError(text) {
  const t = String(text);
  if (/authentication failed|could not read username|invalid username or password|permission denied|error: 40[13]|\b40[13]\b|not logged in|gh auth/i.test(t)) return "GitHub girişi geçersiz görünüyor. Bu bilgisayarda GitHub oturumu yenilenmeli; siteyi hazırlayan kişiye bildirin.";
  if (/could not resolve host|unable to access|network is unreachable|timed out|zaman aşımı/i.test(t)) return "İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip yeniden deneyin.";
  if (/conflict|rebase|non-fast-forward|rejected|fetch first/i.test(t)) return "GitHub'daki sürümle çakışma oldu; hiçbir şey kaybolmadı. Siteyi hazırlayan kişiye bildirin.";
  return "Yayınlama tamamlanamadı. Değişiklikleriniz bu bilgisayarda duruyor; tekrar deneyebilir ya da siteyi hazırlayan kişiye bildirebilirsiniz.";
}

async function walk(directory) {
  const out = [];
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (/\.(json|md)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

export function createPublisher({ root, run = defaultRun, logger = () => {}, github = true, credentialHelper = true, siteUrl = "https://islambol.org", pollMs = 6000, maxWaitMs = 8 * 60 * 1000, exclusive = (task) => task() } = {}) {
  let job = { phase: "idle", message: "", detail: "", finishedAt: null };
  let running = false;
  const set = (patch) => { job = { ...job, ...patch }; };
  const git = (args, options = {}) => run("git", ["--literal-pathspecs", ...args], { cwd: root, ...options });
  const pushArgs = (helper) => [...(helper ? GH_HELPER : []), "push", "origin", `HEAD:${BRANCH}`];

  async function readWorkingBooks() {
    try { return JSON.parse(await readFile(containedPath(root, "data/catalog/books.json"), "utf8")); } catch { return []; }
  }
  async function readHeadBooks() {
    const result = await git(["show", "HEAD:data/catalog/books.json"]);
    if (result.code !== 0) return [];
    try { return JSON.parse(result.stdout); } catch { return []; }
  }
  /** İçerik dosyalarında adı geçen yüklemeler (terk edilmiş yüklemeler dışarıda kalır). */
  async function referencedUploads() {
    const files = [...CONTENT_PATHS.filter((p) => p.endsWith(".json")).map((p) => containedPath(root, p)), ...await walk(containedPath(root, "data/site"))];
    const texts = await Promise.all(files.map((file) => readFile(file, "utf8").catch(() => "")));
    return uploadRefs(texts);
  }
  async function repoState() {
    const top = await git(["rev-parse", "--show-toplevel"]);
    if (top.code !== 0) return { configured: false, reason: "Bu klasör bir git deposu değil." };
    const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    if (branch !== BRANCH) return { configured: false, reason: `Yayınlama yalnız "${BRANCH}" dalından yapılır (şu an: ${branch || "bilinmiyor"}).` };
    const remote = await git(["remote", "get-url", "origin"]);
    if (remote.code !== 0) return { configured: false, reason: "GitHub bağlantısı (origin) tanımlı değil." };
    return { configured: true, remote: remote.stdout.trim(), branch };
  }
  /** Yayınlanacak (değişmiş/yeni) içerik dosyaları: sabit yollar + içerikte kullanılan yüklemeler. */
  async function dirtyFiles() {
    const result = await git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...CONTENT_PATHS, UPLOADS_DIR]);
    if (result.code !== 0) return [];
    const used = await referencedUploads();
    return result.stdout.split("\0").filter(Boolean).map((line) => line.slice(3)).filter((file) => !file.startsWith(`${UPLOADS_DIR}/`) || used.has(file));
  }
  async function unpushedCount() {
    const result = await git(["rev-list", "--count", `origin/${BRANCH}..HEAD`]);
    return result.code === 0 ? Number(result.stdout.trim()) || 0 : 0;
  }
  /** Gönderilmemiş commit başlıkları; panelin kendi commit'leri dışındakiler "yabancı" (başka oturum/kişi): Yayınla onları da göndereceği için onay istenir. */
  async function unpushedSubjects() {
    const result = await git(["log", "--format=%s", `origin/${BRANCH}..HEAD`]);
    return result.code === 0 ? result.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  }

  /** Yayınlanmayı bekleyen değişiklikler. Panelin üst çubuğu bunu gösterir. */
  async function changes() {
    const state = await repoState();
    if (!state.configured) return { configured: false, reason: state.reason, pending: false, text: "", ...snapshot() };
    const [files, subjects] = await Promise.all([dirtyFiles(), unpushedSubjects()]);
    const own = subjects.filter((t) => t.startsWith(PANEL_PREFIX)).length;
    const foreign = subjects.filter((t) => !t.startsWith(PANEL_PREFIX));
    let summary = { added: [], changed: [], removed: [], other: 0 };
    if (files.length) {
      summary = diffBooks(await readHeadBooks(), await readWorkingBooks());
      summary.other = files.some((f) => !/^data\/catalog\/books\.json$/.test(f) && !f.startsWith(`${UPLOADS_DIR}/`)) ? 1 : 0;
    }
    const text = describeChanges(summary) || (files.length ? "kitap bilgileri" : "");
    return { configured: true, pending: files.length > 0 || own > 0, files: files.length, unpushed: subjects.length, foreign: foreign.slice(0, 8), foreignCount: foreign.length, summary, text, ...snapshot() };
  }

  function snapshot() { return { running, job: { ...job } }; }

  /** GitHub Actions bu commit için bitene kadar bekler (gh yoksa ya da erişilemiyorsa beklemeden "gönderildi" der). */
  async function waitForDeploy(sha, remote) {
    const repo = String(remote).match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/i)?.[1];
    if (!github || !repo) return { state: "sent" };
    const started = Date.now();
    let seen = false;
    while (Date.now() - started < maxWaitMs) {
      const result = await run("gh", ["run", "list", "--repo", repo, "--commit", sha, "--json", "status,conclusion,workflowName", "--limit", "10"], { cwd: root, timeout: 30000 });
      if (result.code !== 0) return { state: "sent" };
      let runs = [];
      try { runs = JSON.parse(result.stdout); } catch { return { state: "sent" }; }
      if (runs.length) {
        seen = true;
        if (runs.some((r) => r.status === "completed" && r.conclusion && !["success", "skipped", "neutral"].includes(r.conclusion))) return { state: "failed", detail: runs.map((r) => `${r.workflowName}: ${r.status}/${r.conclusion}`).join("; ") };
        if (runs.every((r) => r.status === "completed")) return { state: "live" };
      }
      set({ message: seen ? "Site güncelleniyor… (genellikle 1–2 dakika)" : "GitHub yayın işini başlatıyor…" });
      await delay(pollMs);
    }
    return { state: "slow" };
  }

  /** Kaydetmelerle çakışmaması için kuyruğa girer; yalnız git işlerini (ekle, işle, çek, gönder) kapsar, dağıtım beklemesini DEĞİL. */
  async function commitAndPush() {
    const state = await repoState();
    if (!state.configured) throw Object.assign(new Error(state.reason), { friendly: state.reason });
    const files = await dirtyFiles();
    if (files.length) {
      set({ phase: "working", message: "Değişiklikler hazırlanıyor…" });
      const summary = diffBooks(await readHeadBooks(), await readWorkingBooks());
      const text = describeChanges({ ...summary, other: 0 }) || "içerik güncellemesi";
      const add = await git(["add", "-A", "--", ...files]);
      if (add.code !== 0) throw Object.assign(new Error(add.stderr), { detail: add.stderr });
      const commit = await git(["commit", "-m", `${PANEL_PREFIX} (${text})`, "--", ...files]);
      if (commit.code !== 0) throw Object.assign(new Error(commit.stderr || commit.stdout), { detail: commit.stderr || commit.stdout });
    } else if (!(await unpushedCount())) {
      return { nothing: true };
    }
    set({ phase: "working", message: "GitHub'a gönderiliyor…" });
    await git(["fetch", "origin", BRANCH], { timeout: 60000 });
    const behind = await git(["rev-list", "--count", `HEAD..origin/${BRANCH}`]);
    if (behind.code === 0 && Number(behind.stdout.trim()) > 0) {
      // Başkasının yarım işi (işlenmemiş izlenen dosyalar) varken üstüne almak onları çakışma işaretleriyle bozabilir: yapılmaz.
      const tree = await git(["status", "--porcelain", "--untracked-files=no"]);
      if (tree.stdout.trim()) throw Object.assign(new Error("Çalışma klasöründe kaydedilmemiş başka değişiklikler var."), { friendly: "GitHub'da yeni değişiklikler var ama bu bilgisayarda kaydedilmemiş başka işler de var; ikisi birleştirilemedi. Hiçbir şey kaybolmadı. Siteyi hazırlayan kişiye bildirin.", detail: tree.stdout });
      const rebase = await git(["pull", "--rebase", "origin", BRANCH], { timeout: 120000 });
      if (rebase.code !== 0) { await git(["rebase", "--abort"]); throw Object.assign(new Error(rebase.stderr), { detail: rebase.stderr }); }
    }
    let push = await git(pushArgs(credentialHelper), { timeout: 120000 });
    if (push.code !== 0 && credentialHelper) push = await git(pushArgs(false), { timeout: 120000 });
    if (push.code !== 0) throw Object.assign(new Error(push.stderr), { detail: push.stderr });
    return { sha: (await git(["rev-parse", "HEAD"])).stdout.trim(), remote: state.remote };
  }

  async function runPublish() {
    const pushed = await exclusive(commitAndPush);
    if (pushed.nothing) {
      set({ phase: "done", message: "Yayınlanacak yeni değişiklik yok; site güncel.", finishedAt: Date.now() });
      return;
    }
    set({ phase: "waiting", message: "GitHub'a gönderildi. Site güncelleniyor…" });
    const outcome = await waitForDeploy(pushed.sha, pushed.remote);
    if (outcome.state === "failed") throw Object.assign(new Error("Yayın işi GitHub'da başarısız oldu."), { friendly: "Değişiklikler GitHub'a gönderildi ama site güncellemesi başarısız oldu. Siteyi hazırlayan kişiye bildirin.", detail: outcome.detail });
    if (outcome.state === "live") set({ phase: "done", message: "Yayında. Değişiklikler sitede görünüyor.", url: siteUrl, finishedAt: Date.now() });
    else if (outcome.state === "slow") set({ phase: "done", message: "Gönderildi; site güncellemesi beklenenden uzun sürüyor. Birkaç dakika sonra siteyi yenileyin.", url: siteUrl, finishedAt: Date.now() });
    else set({ phase: "done", message: "Gönderildi. Site 1–3 dakika içinde güncellenir.", url: siteUrl, finishedAt: Date.now() });
  }

  /** Arka planda başlatır; ilerleme changes().job üzerinden okunur. Aynı anda tek yayın çalışır (kilit eşzamanlı alınır: çift tıklama ikinci yayın başlatmaz). */
  async function start({ confirmForeign = false, confirmHead } = {}) {
    if (running) return { started: false, reason: "Bir yayın zaten sürüyor." };
    running = true;
    let foreign = [];
    let head = "";
    try { foreign = (await unpushedSubjects()).filter((t) => !t.startsWith(PANEL_PREFIX)); head = (await git(["rev-parse", "HEAD"])).stdout.trim(); } catch { /* git okunamazsa yayın kendi hatasını verir */ }
    // Onay, kullanıcının gördüğü commit listesine bağlıdır: arada yeni commit geldiyse yeniden sorulur.
    const confirmed = confirmForeign && (confirmHead === undefined || confirmHead === head);
    if (foreign.length && !confirmed) { running = false; return { started: false, needsConfirm: true, head, foreign: foreign.slice(0, 8), foreignCount: foreign.length }; }
    set({ phase: "working", message: "Yayınlama başlıyor…", detail: "", url: null, finishedAt: null });
    runPublish().catch((error) => {
      logger(`Yayınlama hatası: ${error.stack ?? error.message}`);
      set({ phase: "error", message: error.friendly ?? friendlyError(error.detail ?? error.message), detail: String(error.detail ?? error.message ?? "").slice(-1500), finishedAt: Date.now() });
    }).finally(() => { running = false; });
    return { started: true };
  }

  /** Henüz yayınlanmamış değişiklikleri atar ve son yayınlanan hale döner (yalnız içerik yolları). Commit'lenmiş ama gönderilmemiş işler bu kapsamda değildir. */
  async function discard() {
    if (running) throw Object.assign(new Error("Yayın sürerken geri alınamaz."), { friendly: "Yayın sürerken değişiklikler geri alınamaz." });
    const state = await repoState();
    if (!state.configured) throw Object.assign(new Error(state.reason), { friendly: state.reason });
    if (!(await dirtyFiles()).length) throw Object.assign(new Error("Geri alınacak değişiklik yok."), { friendly: "Geri alınacak, henüz işlenmemiş bir değişiklik yok." });
    // Geri alınacak her şey önce bir yama dosyasına yedeklenir (elle yapılmış düzenleme de olsa kurtarılabilsin).
    const patch = await git(["diff", "HEAD", "--binary", "--", ...CONTENT_PATHS]);
    if (patch.code === 0 && patch.stdout.trim()) {
      const dir = containedPath(root, ".local/cms-backups");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `discard-${Date.now()}.patch`), patch.stdout);
    }
    // Yollar tek tek geri yüklenir: depoda henüz olmayan bir yol ("did not match") diğerlerinin geri alınmasını engellemesin.
    for (const path of CONTENT_PATHS) {
      const restore = await git(["restore", "--source=HEAD", "--staged", "--worktree", "--", path]);
      if (restore.code !== 0 && !/did not match/i.test(restore.stderr)) throw Object.assign(new Error(restore.stderr), { friendly: "Değişiklikler geri alınamadı.", detail: restore.stderr });
    }
    // Yalnız panelin yüklediği (UUID adlı), izlenmeyen dosyalar silinir; elle konmuş dosyalara ve data/site'a dokunulmaz.
    const untracked = await git(["ls-files", "--others", "--exclude-standard", "-z", "--", UPLOADS_DIR]);
    for (const file of untracked.stdout.split("\0").filter(Boolean)) {
      if (PANEL_UPLOAD.test(file.slice(UPLOADS_DIR.length + 1))) await rm(containedPath(root, file), { force: true });
    }
    set({ phase: "idle", message: "", detail: "", finishedAt: null });
  }

  return { changes, start, discard, snapshot };
}
