import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/core/http.js";
import { openverse } from "../../src/providers/openverse.js";

// Live check against the real site: LIVE=1 npx vitest run test/live/openverse.live.test.ts
describe.runIf(process.env.LIVE)("openverse (live)", () => {
  const ctx = { fetch: createHttpClient() };

  it("finds images with a licence, and one image's file is an image on the source's servers", async () => {
    const res = await openverse.search({ query: "mountain lake", limit: 8 }, ctx);
    expect(res.images.length).toBeGreaterThan(0);
    for (const a of res.images) expect(a.license?.verdict, a.id).toBeTruthy();
    const details = await openverse.getImage!(res.images[0]!.nativeId, ctx);
    expect(details).not.toBeNull();
    const file = details!.files.find((f) => f.role === "original" || f.role === "rendition") ?? details!.files[0];
    expect(file).toBeDefined();
    const res2 = await fetch(file!.url, { method: "GET", redirect: "follow", headers: { "user-agent": "image-asset-server-live-test (+https://image.shep.bot)", range: "bytes=0-1023" } });
    await res2.body?.cancel();
    expect(res2.ok, file!.url).toBe(true);
    expect(res2.headers.get("content-type") ?? "", file!.url).toMatch(/^(image\/|application\/octet-stream|binary\/octet-stream)/);
  }, 90_000);

  it("counts its catalogue", async () => {
    expect((await openverse.census!(ctx)).total).toBeGreaterThan(0);
  }, 90_000);
});
