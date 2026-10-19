// GitHub REST (Git Data API) istemcisi: yalnız standart fetch kullanır (Worker ve Node aynı kodu çalıştırır).
// Cloudflare ücretsiz planında bir istek en çok 50 alt istek yapabilir; `budget` bunu aşmadan önce anlaşılır bir hatayla durur.
import { CmsError } from "../../scripts/cms/content.mjs";

const TIMEOUT_MS = 25_000;   // takılan bir GitHub isteği tüm kuyruğu bekletmesin

export class BudgetExhausted extends Error {
  constructor() { super("Alt istek sınırına yaklaşıldı; işlem sonraki adımda sürdürülecek."); this.name = "BudgetExhausted"; }
}

export class GithubError extends CmsError {
  constructor(status, message, detail = "") { super(502, message); this.name = "GithubError"; this.githubStatus = status; this.detail = detail; }
}

const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};
export { bytesToBase64 };

export function createGithub({ token, repo, fetch: request = globalThis.fetch, apiBase = "https://api.github.com", limit = 44 }) {
  let remaining = limit;
  const headers = { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", "user-agent": "islambol-panel" };
  const url = (path) => `${apiBase}/repos/${repo}${path}`;

  async function call(path, { method = "GET", body, raw = false } = {}) {
    if (remaining <= 0) throw new BudgetExhausted();
    remaining -= 1;
    let response;
    try {
      response = await request(url(path), { method, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { ...headers, ...(raw ? { accept: "application/vnd.github.raw+json" } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (error) { throw new GithubError(0, "GitHub'a ulaşılamadı. İnternet bağlantısı ya da GitHub geçici olarak kapalı olabilir.", String(error?.message ?? error)); }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 600);
      if (response.status === 401) throw new GithubError(401, "GitHub erişim anahtarı geçersiz ya da süresi dolmuş. Siteyi hazırlayan kişiye bildirin.", detail);
      if (response.status === 403 || response.status === 429) throw new GithubError(response.status, /rate limit|abuse/i.test(detail) ? "GitHub kısa süreliğine istekleri sınırladı. Biraz bekleyip yeniden deneyin." : "GitHub erişim anahtarının bu işlem için izni yok. Siteyi hazırlayan kişiye bildirin.", detail);
      throw new GithubError(response.status, `GitHub isteği başarısız oldu (${response.status}).`, detail);
    }
    return raw ? response.text() : response.json();
  }

  return {
    /** Her Worker isteğinin başında çağrılır. */
    resetBudget() { remaining = limit; },
    get remaining() { return remaining; },
    async ref(branch) { return (await call(`/git/ref/heads/${branch}`)).object.sha; },
    async commit(sha) { const data = await call(`/git/commits/${sha}`); return { sha: data.sha, tree: data.tree.sha }; },
    /** Commit SHA'sından özyinelemeli dosya listesi: [{ path, sha, type }]. */
    async tree(sha) {
      const data = await call(`/git/trees/${sha}?recursive=1`);
      if (data.truncated) throw new GithubError(0, "Depo dosya listesi çok büyük; yayın okunamadı.");
      return data.tree;
    },
    blob(sha) { return call(`/git/blobs/${sha}`, { raw: true }); },
    async createBlob({ text, bytes }) {
      const body = bytes ? { content: bytesToBase64(bytes), encoding: "base64" } : { content: text, encoding: "utf-8" };
      return (await call("/git/blobs", { method: "POST", body })).sha;
    },
    async createTree(base, entries) {
      return (await call("/git/trees", { method: "POST", body: { base_tree: base, tree: entries.map(({ path, sha }) => ({ path, mode: "100644", type: "blob", sha })) } })).sha;
    },
    async createCommit({ message, tree, parent }) {
      return (await call("/git/commits", { method: "POST", body: { message, tree, parents: [parent] } })).sha;
    },
    /** Hızlı ileri sarma: bu arada dal ilerlediyse GitHub 422 döner ve `moved: true` ile bildirilir. */
    async moveBranch(branch, sha) {
      try { await call(`/git/refs/heads/${branch}`, { method: "PATCH", body: { sha, force: false } }); return { moved: false }; }
      catch (error) { if (error instanceof GithubError && error.githubStatus === 422) return { moved: true }; throw error; }
    },
    async runs(sha) {
      const data = await call(`/actions/runs?head_sha=${sha}&per_page=10`);
      return (data.workflow_runs ?? []).map((run) => ({ name: run.name, status: run.status, conclusion: run.conclusion }));
    },
  };
}
