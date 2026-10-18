import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPublisher, defaultRun, describeChanges, diffBooks, friendlyError, uploadRefs } from "../../scripts/cms/publish.mjs";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const book = (id, title = id) => ({ id, title, authors: [], cover: {}, sources: {} });
const write = (root, file, value) => writeFile(join(root, file), typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n");

/** Gerçek git: sahte "GitHub" olarak yerel bir çıplak depo; panelin çalışma kopyası ondan klonlanır. */
async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), "islambol-publish-"));
  const origin = join(base, "origin.git");
  const work = join(base, "work");
  git(base, "init", "--bare", "-b", "main", origin);
  git(base, "clone", origin, work);
  git(work, "config", "user.name", "Test");
  git(work, "config", "user.email", "test@example.com");
  git(work, "checkout", "-B", "main");
  for (const dir of ["data/catalog", "data/site", "public/uploads", "src"]) await mkdir(join(work, dir), { recursive: true });
  await write(work, "data/catalog/books.json", [book("ilk", "İlk Kitap")]);
  await write(work, "data/catalog/authors.json", []);
  await write(work, "data/site/site.json", { ad: "Deneme" });
  await write(work, "public/uploads/.gitkeep", "");
  await write(work, "src/sablon.njk", "ilk");
  git(work, "add", "-A");
  git(work, "commit", "-m", "ilk");
  git(work, "push", "-u", "origin", "main");
  const publisher = createPublisher({ root: work, github: false, credentialHelper: false, pollMs: 1 });
  t.after(() => rm(base, { recursive: true, force: true }));
  return { base, origin, work, publisher, git: (...args) => git(work, ...args) };
}

async function finish(publisher) {
  for (let i = 0; i < 400 && publisher.snapshot().running; i++) await new Promise((done) => setTimeout(done, 25));
  return publisher.snapshot().job;
}

test("hiçbir şey değişmediyse bekleyen değişiklik yok, Yayınla kibarca 'güncel' der", async (t) => {
  const f = await fixture(t);
  const state = await f.publisher.changes();
  assert.equal(state.configured, true);
  assert.equal(state.pending, false);
  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "done");
  assert.match(job.message, /yeni değişiklik yok/);
});

test("yeni kitap + yükleme: özet doğru, yalnız içerik yolları commit'lenir, başkasının yarım işi dokunulmaz kalır", async (t) => {
  const f = await fixture(t);
  await write(f.work, "data/catalog/books.json", [book("ilk", "İlk Kitap"), { ...book("yeni", "Yeni Kitap"), cover: { local_path: "public/uploads/kapak.jpg" } }]);
  await write(f.work, "public/uploads/kapak.jpg", "jpg");
  await write(f.work, "public/uploads/terk-edilmis.jpg", "orphan");   // hiçbir içerikte adı geçmiyor: genel depoya gitmemeli
  await write(f.work, "src/sablon.njk", "BAŞKASININ YARIM İŞİ");           // içerik yolu değil
  const state = await f.publisher.changes();
  assert.equal(state.pending, true);
  assert.deepEqual(state.summary.added, ["Yeni Kitap"]);
  assert.equal(state.text, "1 yeni kitap");

  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "done", job.message);
  const files = git(f.origin, "show", "--name-only", "--format=", "main").split("\n").filter(Boolean).sort();
  assert.deepEqual(files, ["data/catalog/books.json", "public/uploads/kapak.jpg"]);
  assert.match(git(f.origin, "log", "-1", "--format=%s", "main"), /içerik: panelden güncelleme \(1 yeni kitap\)/);
  assert.match(f.git("status", "--porcelain"), /src\/sablon\.njk/, "başkasının dosyası commit'lenmemeli");
  assert.match(f.git("status", "--porcelain", "--untracked-files=all"), /public\/uploads\/terk-edilmis\.jpg/, "terk edilmiş yükleme commit'lenmemeli");
  assert.equal((await f.publisher.changes()).pending, false);
});

test("düzenlenen ve silinen kitaplar ayrı sayılır", () => {
  const diff = diffBooks([book("ilk", "İlk Kitap"), book("silinecek", "Eski")], [{ ...book("ilk", "İlk Kitap"), description: "a" }, book("yeni", "Yeni")]);
  assert.deepEqual(diff, { added: ["Yeni"], changed: ["İlk Kitap"], removed: ["Eski"] });
  assert.equal(describeChanges({ ...diff, other: 1 }), "1 yeni kitap, 1 düzenlenen kitap, 1 silinen kitap, site bilgileri");
});

test("geri al: yayınlanmamış değişiklikler ve yeni yüklemeler atılır, başkasının işi kalır", async (t) => {
  const f = await fixture(t);
  await write(f.work, "data/catalog/books.json", [book("x", "Başka")]);
  await write(f.work, "public/uploads/0b8f1a3c-5d2e-4f60-9a7b-1c2d3e4f5a6c.jpg", "jpg");
  await write(f.work, "src/sablon.njk", "BAŞKASININ İŞİ");
  assert.equal((await f.publisher.changes()).pending, true);
  await f.publisher.discard();
  assert.equal((await f.publisher.changes()).pending, false);
  assert.deepEqual(JSON.parse(await readFile(join(f.work, "data/catalog/books.json"), "utf8")).map((b) => b.id), ["ilk"]);
  assert.equal(existsSync(join(f.work, "public/uploads/0b8f1a3c-5d2e-4f60-9a7b-1c2d3e4f5a6c.jpg")), false);
  assert.equal(await readFile(join(f.work, "src/sablon.njk"), "utf8"), "BAŞKASININ İŞİ");
});

test("GitHub'da yeni commit varsa önce üstüne alınır (rebase), sonra gönderilir", async (t) => {
  const f = await fixture(t);
  const other = join(f.base, "baska");
  git(f.base, "clone", f.origin, other);
  git(other, "config", "user.name", "Baska");
  git(other, "config", "user.email", "b@example.com");
  await write(other, "README.md", "uzaktan");
  git(other, "add", "-A");
  git(other, "commit", "-m", "uzak değişiklik");
  git(other, "push", "origin", "main");
  await write(f.work, "data/site/site.json", { ad: "Yeni Ad" });
  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "done", job.message + job.detail);
  const log = git(f.origin, "log", "--format=%s", "main");
  assert.match(log, /uzak değişiklik/);
  assert.match(log, /içerik: panelden güncelleme/);
});

test("gönderme başarısız olursa yerel commit kalır, 'bekleyen' görünür ve hata sade Türkçedir", async (t) => {
  const f = await fixture(t);
  git(f.work, "remote", "set-url", "origin", join(f.base, "yok.git"));
  await write(f.work, "data/catalog/books.json", [book("ilk", "İlk Kitap"), book("yeni", "Yeni")]);
  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "error");
  assert.ok(job.message.length > 20 && !/fatal:/.test(job.message), "kullanıcıya ham git çıktısı gösterilmez");
  assert.ok(job.detail.length > 0, "teknik ayrıntı ayrıca saklanır");
  git(f.work, "remote", "set-url", "origin", f.origin);
  assert.equal((await f.publisher.changes()).pending, true, "yerel commit gönderilmeyi bekliyor");
  await f.publisher.start();
  assert.equal((await finish(f.publisher)).phase, "done");
  assert.match(git(f.origin, "log", "-1", "--format=%s", "main"), /içerik: panelden güncelleme/);
});

test("git deposu olmayan klasörde yayınlama 'kurulu değil' der, panel çökmez", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "islambol-nogit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const publisher = createPublisher({ root: dir, github: false });
  const state = await publisher.changes();
  assert.equal(state.configured, false);
  assert.match(state.reason, /git deposu değil/);
  await publisher.start();
  const job = await finish(publisher);
  assert.equal(job.phase, "error");
});

test("hata çevirisi: ağ, giriş ve çakışma ayrı, sade cümleler", () => {
  assert.match(friendlyError("fatal: unable to access 'https://github.com/': Could not resolve host: github.com"), /İnternet/);
  assert.match(friendlyError("remote: Invalid username or password. fatal: Authentication failed"), /GitHub girişi/);
  assert.match(friendlyError("! [rejected] main -> main (non-fast-forward)"), /çakışma/);
  assert.match(friendlyError("bilinmeyen"), /tekrar deneyebilir/);
});

/** git gerçek (yerel çıplak depo), GitHub/gh sahte: remote adresi github.com gibi görünür, gh iş durumunu taklit eder. */
async function withFakeGh(t, conclusion) {
  const f = await fixture(t);
  const calls = [];
  const fake = async (file, args, options) => {
    if (file === "gh") {
      calls.push(args.join(" "));
      const done = calls.length >= 2;
      return { code: 0, stdout: JSON.stringify([{ status: done ? "completed" : "in_progress", conclusion: done ? conclusion : "", workflowName: "Pages" }]), stderr: "" };
    }
    if (file === "git" && args.includes("get-url")) return { code: 0, stdout: "https://github.com/ornek/depo.git\n", stderr: "" };
    return defaultRun(file, args, options);
  };
  const publisher = createPublisher({ root: f.work, run: fake, github: true, credentialHelper: false, pollMs: 1, siteUrl: "https://example.org" });
  await write(f.work, "data/site/site.json", { ad: "Başka" });
  return { ...f, publisher, calls };
}

test("gh ile dağıtım beklenir: iş başarıyla biterse 'Yayında' denir", async (t) => {
  const f = await withFakeGh(t, "success");
  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "done", job.message + job.detail);
  assert.match(job.message, /Yayında/);
  assert.equal(job.url, "https://example.org");
  assert.ok(f.calls.length >= 2, "gh en az iki kez sorgulandı");
  assert.match(f.calls[0], /--repo ornek\/depo/);
});

test("GitHub'daki yayın işi başarısız olursa sade hata gösterilir (değişiklik gönderilmiş olsa da)", async (t) => {
  const f = await withFakeGh(t, "failure");
  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "error");
  assert.match(job.message, /site güncellemesi başarısız/);
});

test("başka oturumdan kalan gönderilmemiş commit'ler Yayınla'yı durdurur ve onay ister; onayla birlikte gönderilir", async (t) => {
  const f = await fixture(t);
  await write(f.work, "src/baska.njk", "başkasının işi");
  git(f.work, "add", "src/baska.njk");
  git(f.work, "commit", "-m", "feat: başka oturumun işi");
  await write(f.work, "data/catalog/books.json", [book("ilk", "İlk Kitap"), book("yeni", "Yeni Kitap")]);
  const state = await f.publisher.changes();
  assert.equal(state.pending, true);
  assert.deepEqual(state.foreign, ["feat: başka oturumun işi"]);
  assert.equal(state.foreignCount, 1);

  const asked = await f.publisher.start();
  assert.equal(asked.started, false);
  assert.equal(asked.needsConfirm, true);
  assert.deepEqual(asked.foreign, ["feat: başka oturumun işi"]);
  assert.equal(git(f.origin, "log", "--format=%s", "main").includes("başka oturumun"), false, "onaysız hiçbir şey gönderilmez");

  assert.equal((await f.publisher.start({ confirmForeign: true })).started, true);
  const job = await finish(f.publisher);
  assert.equal(job.phase, "done", job.message);
  assert.match(git(f.origin, "log", "--format=%s", "main"), /başka oturumun işi/);
});

test("yalnız yabancı commit varsa panelde 'bekleyen değişiklik' sayılmaz ama bilgi olarak bildirilir", async (t) => {
  const f = await fixture(t);
  await write(f.work, "src/baska.njk", "x");
  git(f.work, "add", "src/baska.njk");
  git(f.work, "commit", "-m", "chore: yabancı");
  const state = await f.publisher.changes();
  assert.equal(state.pending, false);
  assert.equal(state.foreignCount, 1);
});

test("yalnız terk edilmiş (hiçbir içerikte kullanılmayan) yükleme varsa bekleyen değişiklik sayılmaz", async (t) => {
  const f = await fixture(t);
  await write(f.work, "public/uploads/yetim.png", "x");
  assert.equal((await f.publisher.changes()).pending, false);
});

test("uploadRefs: içerik metinlerinden yalnız geçerli yükleme adlarını toplar", () => {
  const refs = uploadRefs(['{"cover":{"local_path":"public/uploads/a-1.jpg"}}', '{"photo_url":"/uploads/b.PNG"}', '"/uploads/c.exe" "/uploads/-x.jpg"']);
  assert.deepEqual([...refs].sort(), ["public/uploads/a-1.jpg", "public/uploads/b.PNG"]);
});

test("büyük katalog (>200 KB, Türkçe karakterli): kitap özeti doğru, 'hepsi yeni' görünmez", async (t) => {
  const f = await fixture(t);
  const many = Array.from({ length: 120 }, (_, i) => ({ ...book(`kitap-${i}`, `Şöyle Çiğ Öğüt ${i}`), description: "ğüşiöç ".repeat(300) }));
  await write(f.work, "data/catalog/books.json", many);
  git(f.work, "add", "-A");
  git(f.work, "commit", "-m", "büyük katalog");
  git(f.work, "push", "origin", "main");
  assert.ok((await readFile(join(f.work, "data/catalog/books.json"), "utf8")).length > 250000);
  await write(f.work, "data/catalog/books.json", [...many, book("yeni", "Tek Yeni Kitap")]);
  const state = await f.publisher.changes();
  assert.deepEqual(state.summary.added, ["Tek Yeni Kitap"], "yalnız gerçekten yeni olan kitap");
  assert.deepEqual(state.summary.changed, []);
  assert.equal(state.text, "1 yeni kitap");
});

test("dağıtım beklenirken kuyruk serbesttir: kaydetmeler ve okumalar yayın sırasında takılmaz", async (t) => {
  const f = await fixture(t);
  let inside = false;
  let queueFreeDuringPoll = null;
  const exclusive = async (task) => { inside = true; try { return await task(); } finally { inside = false; } };
  const fake = async (file, args, options) => {
    if (file === "gh") { queueFreeDuringPoll = !inside; return { code: 0, stdout: JSON.stringify([{ status: "completed", conclusion: "success", workflowName: "Pages" }]), stderr: "" }; }
    if (file === "git" && args.includes("get-url")) return { code: 0, stdout: "https://github.com/ornek/depo.git\n", stderr: "" };
    return defaultRun(file, args, options);
  };
  const publisher = createPublisher({ root: f.work, run: fake, exclusive, github: true, credentialHelper: false, pollMs: 1 });
  await write(f.work, "data/site/site.json", { ad: "Kuyruk" });
  await publisher.start();
  const job = await finish(publisher);
  assert.equal(job.phase, "done", job.message);
  assert.equal(queueFreeDuringPoll, true, "gh sorgusu kuyruk kilidi dışında yapılmalı");
});

test("çift tıklama: ikinci Yayınla ikinci bir yayın başlatmaz", async (t) => {
  const f = await fixture(t);
  await write(f.work, "data/site/site.json", { ad: "Çift" });
  const [a, b] = await Promise.all([f.publisher.start(), f.publisher.start()]);
  assert.deepEqual([a.started, b.started].sort(), [false, true]);
  assert.equal((await finish(f.publisher)).phase, "done");
  assert.equal(git(f.origin, "log", "--format=%s", "main").split("\n").filter((l) => l.startsWith("içerik:")).length, 1);
});

test("geri alınacak bir şey yokken Geri al sahte başarı vermez", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.publisher.discard(), (e) => /Geri alınacak/.test(e.friendly));
});

test("403 hatası ağ sorunu olarak yanlış etiketlenmez", () => {
  assert.match(friendlyError("fatal: unable to access 'https://github.com/x/y.git/': The requested URL returned error: 403"), /GitHub girişi/);
});

test("geri al: önce yama yedeği alınır, yalnız panelin (UUID adlı) izlenmeyen yüklemeleri silinir; elle konmuş dosyalar ve data/site yeni dosyaları kalır", async (t) => {
  const f = await fixture(t);
  const panelUpload = "public/uploads/0b8f1a3c-5d2e-4f60-9a7b-1c2d3e4f5a6b.jpg";
  await write(f.work, "data/catalog/books.json", [book("x", "Başka")]);
  await write(f.work, panelUpload, "panel");
  await write(f.work, "public/uploads/elle-konan-onizleme-01.jpg", "elle");
  await write(f.work, "data/site/yeni-sayfa.md", "kalmalı");
  await f.publisher.discard();
  assert.equal(existsSync(join(f.work, panelUpload)), false, "panelin kendi yüklemesi silinir");
  assert.equal(existsSync(join(f.work, "public/uploads/elle-konan-onizleme-01.jpg")), true, "elle konan dosya korunur");
  assert.equal(existsSync(join(f.work, "data/site/yeni-sayfa.md")), true, "data/site'ta izlenmeyen dosyaya dokunulmaz");
  const backups = (await readdir(join(f.work, ".local/cms-backups"))).filter((n) => n.startsWith("discard-"));
  assert.equal(backups.length, 1, "geri alınan değişiklik yama olarak yedeklendi");
  assert.match(await readFile(join(f.work, ".local/cms-backups", backups[0]), "utf8"), /"id": "x"/);
});

test("yabancı commit onayı gördüğü HEAD'e bağlıdır: arada yeni commit gelirse yeniden sorulur", async (t) => {
  const f = await fixture(t);
  await write(f.work, "src/a.njk", "1");
  git(f.work, "add", "src/a.njk");
  git(f.work, "commit", "-m", "feat: birinci yabancı");
  await write(f.work, "data/catalog/books.json", [book("ilk", "İlk Kitap"), book("yeni", "Yeni")]);
  const asked = await f.publisher.start();
  assert.equal(asked.needsConfirm, true);
  assert.match(asked.head, /^[0-9a-f]{40}$/);
  await write(f.work, "src/b.njk", "2");                                 // onay penceresi açıkken yeni bir yabancı commit geliyor
  git(f.work, "add", "src/b.njk");
  git(f.work, "commit", "-m", "feat: ikinci yabancı (kullanıcı görmedi)");
  const again = await f.publisher.start({ confirmForeign: true, confirmHead: asked.head });
  assert.equal(again.started, false, "eski onay yeni commit'i kapsamaz");
  assert.equal(again.needsConfirm, true);
  assert.equal(again.foreignCount, 2);
  assert.equal(git(f.origin, "log", "--format=%s", "main").includes("yabancı"), false, "hiçbir şey gönderilmedi");
  assert.equal((await f.publisher.start({ confirmForeign: true, confirmHead: again.head })).started, true);
  assert.equal((await finish(f.publisher)).phase, "done");
});

test("GitHub'da yeni commit var ve çalışma klasöründe başka kaydedilmemiş iş varsa birleştirme denenmez, iş bozulmaz", async (t) => {
  const f = await fixture(t);
  const other = join(f.base, "baska");
  git(f.base, "clone", f.origin, other);
  git(other, "config", "user.name", "Baska");
  git(other, "config", "user.email", "b@example.com");
  await write(other, "src/sablon.njk", "uzak sürüm");
  git(other, "add", "-A");
  git(other, "commit", "-m", "uzak");
  git(other, "push", "origin", "main");
  await write(f.work, "src/sablon.njk", "YEREL YARIM İŞ");                // izlenen dosya, işlenmemiş
  await write(f.work, "data/site/site.json", { ad: "Panel Değişikliği" });
  await f.publisher.start();
  const job = await finish(f.publisher);
  assert.equal(job.phase, "error");
  assert.match(job.message, /birleştirilemedi/);
  assert.equal(await readFile(join(f.work, "src/sablon.njk"), "utf8"), "YEREL YARIM İŞ", "yarım iş bozulmadı");
  assert.doesNotMatch(await readFile(join(f.work, "src/sablon.njk"), "utf8"), /<<<<<<</);
});
