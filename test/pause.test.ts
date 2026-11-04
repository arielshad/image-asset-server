import { describe, expect, it } from "vitest";
import { HttpError } from "../src/core/http.js";
import { pauseOnRefusal } from "../src/providers/pause.js";

describe("pauseOnRefusal", () => {
  it("pauses after a refusal, fails fast meanwhile, and ignores other errors", async () => {
    const pause = pauseOnRefusal("Site", { status: [403], pauseMs: () => 60_000 });
    let calls = 0;
    const refused = () => {
      calls++;
      return Promise.reject(new HttpError(403, "https://x"));
    };
    await expect(pause.run(refused)).rejects.toThrow(/HTTP 403/);
    await expect(pause.run(refused)).rejects.toThrow(/Site refused our requests; paused until/);
    expect(calls).toBe(1);
    pause.reset();
    await expect(pause.run(() => Promise.reject(new HttpError(500, "https://x")))).rejects.toThrow(/HTTP 500/);
    await expect(pause.run(async () => "ok")).resolves.toBe("ok");
  });
});
