import { HttpError } from "../core/http.js";

/**
 * After a source refuses us (403 from a bot wall, 429 from a rate limit),
 * stop asking for a while instead of hitting it on every search. Calls made
 * during the pause fail fast with `message`, so the source shows as "error"
 * with the reason and the search does not wait on it.
 */
export function pauseOnRefusal(name: string, opts: { status: number[]; pauseMs: (e: HttpError) => number; hint?: string }) {
  let until = 0;
  return {
    async run<T>(call: () => Promise<T>): Promise<T> {
      if (Date.now() < until) {
        throw new Error(`${name} refused our requests; paused until ${new Date(until).toISOString()}${opts.hint ? ` (${opts.hint})` : ""}`);
      }
      try {
        return await call();
      } catch (e) {
        if (e instanceof HttpError && opts.status.includes(e.status)) until = Date.now() + opts.pauseMs(e);
        throw e;
      }
    },
    /** For tests. */
    reset(): void {
      until = 0;
    },
  };
}
