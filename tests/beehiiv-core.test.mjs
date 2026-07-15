// Passo 2 — núcleo compartilhado do publisher Beehiiv (Daily + Weekly).
// Testa as peças puras: parseArgs, buildPayload, contentHash, weeklySlug.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, buildPayload, contentHash } from "../scripts/beehiiv-core.mjs";
import { weeklySlug } from "../scripts/beehiiv-publish-weekly.mjs";

test("parseArgs: ações e flags", () => {
  assert.equal(parseArgs(["--publish"]).action, "publish");
  assert.equal(parseArgs(["--schedule", "2026-07-20T09:00:00-03:00"]).schedule, "2026-07-20T09:00:00-03:00");
  assert.equal(parseArgs(["content/weekly/2026-W28.json"]).path, "content/weekly/2026-W28.json");
  assert.equal(parseArgs(["--dry-run"]).dryRun, true);
  assert.equal(parseArgs([]).action, "draft"); // default
});

test("buildPayload: title/status/slug corretos; draft vs confirmed", () => {
  const draft = buildPayload({ subject: "S", preheader: "P", html: "<x>", slug: "weekly-2026-w28", action: "draft", tags: ["a"] });
  assert.equal(draft.title, "S");
  assert.equal(draft.status, "draft");
  assert.equal(draft.web_settings.slug, "weekly-2026-w28");
  assert.deepEqual(draft.content_tags, ["a"]);
  const pub = buildPayload({ subject: "S", html: "<x>", slug: "s", action: "publish" });
  assert.equal(pub.status, "confirmed");
});

test("buildPayload: sem subject → erro (Beehiiv exige title)", () => {
  assert.throws(() => buildPayload({ html: "<x>", slug: "s", action: "draft" }), /subject ausente/);
});

test("contentHash: muda com o conteúdo, estável para o mesmo conteúdo", () => {
  const a = contentHash({ html: "<x>", plain: "x", slug: "s", subject: "S", preheader: "P", tags: [], scheduledAt: null });
  const b = contentHash({ html: "<x>", plain: "x", slug: "s", subject: "S", preheader: "P", tags: [], scheduledAt: null });
  const c = contentHash({ html: "<y>", plain: "x", slug: "s", subject: "S", preheader: "P", tags: [], scheduledAt: null });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^sha256:/);
});

test("weeklySlug: usa wk.slug, ou deriva do número", () => {
  assert.equal(weeklySlug({ slug: "weekly-2026-w28", number: 28 }), "weekly-2026-w28");
  assert.equal(weeklySlug({ number: 7 }), "weekly-0007");
});
