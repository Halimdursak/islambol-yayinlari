// Test için bellek içi GitHub: Git Data API uç noktalarının (ref, commit, tree, blob, actions) gerçeğe sadık küçük bir kopyası.
import { createHash } from "node:crypto";

const sha1 = (...parts) => createHash("sha1").update(Buffer.concat(parts.map((p) => Buffer.from(p)))).digest("hex");
export const blobSha = (bytes) => { const data = Buffer.from(bytes); return sha1(`blob ${data.length}\0`, data); };

export function createFakeGithub({ repo = "owner/repo", files = {} } = {}) {
  const blobs = new Map();       // sha → Buffer
  const trees = new Map();       // tree sha → Map(path → blob sha)
  const commits = new Map();     // commit sha → { tree, parents, message }
  const refs = new Map();        // branch → commit sha
  const runs = new Map();        // commit sha → [{ name, status, conclusion }]
  const log = [];                // { method, path } her istek (alt istek sayımı için)
  let counter = 0;
  const behavior = { failNext: null, runsFor: null };

  const addBlob = (bytes) => { const data = Buffer.from(bytes); const sha = blobSha(data); blobs.set(sha, data); return sha; };
  const addTree = (entries) => { const map = new Map(entries); const sha = sha1("tree", JSON.stringify([...map].sort())); trees.set(sha, map); return sha; };
  const addCommit = ({ tree, parents, message }) => { const sha = sha1("commit", JSON.stringify({ tree, parents, message, n: counter++ })); commits.set(sha, { tree, parents, message }); return sha; };

  /** Doğrudan (panel dışından) bir commit ekler: başka birinin main'e göndermesi. */
  function pushExternal(changes, message = "başkasının commit'i") {
    const head = refs.get("main");
    const map = new Map(trees.get(commits.get(head).tree));
    for (const [path, content] of Object.entries(changes)) { if (content === null) map.delete(path); else map.set(path, addBlob(content)); }
    const commit = addCommit({ tree: addTree(map), parents: [head], message });
    refs.set("main", commit);
    return commit;
  }
  const initial = addCommit({ tree: addTree(Object.entries(files).map(([path, content]) => [path, addBlob(content)])), parents: [], message: "ilk" });
  refs.set("main", initial);

  const reply = (status, body, text) => new Response(text ?? JSON.stringify(body), { status, headers: { "content-type": text === undefined ? "application/json" : "text/plain" } });

  async function fetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = init.method ?? "GET";
    const prefix = `/repos/${repo}`;
    if (!url.pathname.startsWith(prefix)) return reply(404, { message: "Not Found" });
    const path = url.pathname.slice(prefix.length);
    log.push({ method, path });
    if (behavior.failNext) { const fail = behavior.failNext; behavior.failNext = null; return reply(fail.status, { message: fail.message ?? "hata" }); }
    const body = init.body ? JSON.parse(init.body) : {};
    let match;
    if (method === "GET" && (match = path.match(/^\/git\/ref\/heads\/(.+)$/))) {
      return refs.has(match[1]) ? reply(200, { object: { sha: refs.get(match[1]) } }) : reply(404, { message: "Not Found" });
    }
    if (method === "GET" && (match = path.match(/^\/git\/commits\/([0-9a-f]{40})$/))) {
      const commit = commits.get(match[1]);
      return commit ? reply(200, { sha: match[1], tree: { sha: commit.tree } }) : reply(404, { message: "Not Found" });
    }
    if (method === "GET" && (match = path.match(/^\/git\/trees\/([0-9a-f]{40})$/))) {
      const commit = commits.get(match[1]);
      const map = trees.get(commit ? commit.tree : match[1]);
      if (!map) return reply(404, { message: "Not Found" });
      return reply(200, { sha: match[1], truncated: false, tree: [...map].map(([p, sha]) => ({ path: p, mode: "100644", type: "blob", sha })) });
    }
    if (method === "GET" && (match = path.match(/^\/git\/blobs\/([0-9a-f]{40})$/))) {
      return blobs.has(match[1]) ? reply(200, null, blobs.get(match[1]).toString("utf8")) : reply(404, { message: "Not Found" });
    }
    if (method === "POST" && path === "/git/blobs") {
      const bytes = body.encoding === "base64" ? Buffer.from(body.content, "base64") : Buffer.from(body.content, "utf8");
      return reply(201, { sha: addBlob(bytes) });
    }
    if (method === "POST" && path === "/git/trees") {
      const base = trees.get(body.base_tree);
      if (!base) return reply(422, { message: "base_tree bulunamadı" });
      const map = new Map(base);
      for (const entry of body.tree) { if (!blobs.has(entry.sha)) return reply(422, { message: "blob yok" }); map.set(entry.path, entry.sha); }
      return reply(201, { sha: addTree(map) });
    }
    if (method === "POST" && path === "/git/commits") return reply(201, { sha: addCommit({ tree: body.tree, parents: body.parents, message: body.message }) });
    if (method === "PATCH" && (match = path.match(/^\/git\/refs\/heads\/(.+)$/))) {
      const current = refs.get(match[1]);
      // Hızlı ileri sarma denetimi: yeni commit'in atası mevcut ucu içermeli.
      let cursor = body.sha; let ok = false;
      while (cursor) { if (cursor === current) { ok = true; break; } cursor = commits.get(cursor)?.parents[0]; }
      if (!ok && !body.force) return reply(422, { message: "Update is not a fast forward" });
      refs.set(match[1], body.sha);
      return reply(200, { object: { sha: body.sha } });
    }
    if (method === "GET" && path === "/actions/runs") {
      const sha = url.searchParams.get("head_sha");
      const list = behavior.runsFor ? behavior.runsFor(sha) : (runs.get(sha) ?? []);
      return reply(200, { workflow_runs: list });
    }
    return reply(404, { message: `Beklenmeyen istek: ${method} ${path}` });
  }

  return {
    fetch, log, behavior, refs, commits,
    head: () => refs.get("main"),
    treeOf: (sha = refs.get("main")) => trees.get(commits.get(sha).tree),
    fileText: (path, sha = refs.get("main")) => { const id = trees.get(commits.get(sha).tree).get(path); return id ? blobs.get(id).toString("utf8") : null; },
    fileBytes: (path, sha = refs.get("main")) => { const id = trees.get(commits.get(sha).tree).get(path); return id ? blobs.get(id) : null; },
    pushExternal,
    setRuns(sha, list) { runs.set(sha, list); },
    commitCount: () => commits.size,
    resetLog() { log.length = 0; },
  };
}
