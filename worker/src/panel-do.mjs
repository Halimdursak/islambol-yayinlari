// Cloudflare Durable Object: panelin tek örneği. Tüm API mantığı panel.mjs'te; bu sınıf yalnız onu Cloudflare'e bağlar.
// (Ücretsiz planda yalnız SQLite destekli sınıflar kullanılabilir; sınıf `new_sqlite_classes` ile tanımlanır.)
import validateBook from "../generated/validate-book.cjs";
import { CATEGORIES, PREVIEW_SLUGS } from "../generated/data.mjs";
import { createPanel } from "./panel.mjs";

export class Panel {
  constructor(ctx, env) {
    this.panel = createPanel({ storage: ctx.storage, env, validateBook, previewSlugs: PREVIEW_SLUGS, categories: CATEGORIES, minPassword: 12 });
  }

  fetch(request) { return this.panel.handle(request); }
}
