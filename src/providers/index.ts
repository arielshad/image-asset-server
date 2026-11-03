import type { Provider } from "../core/types.js";
import { artic } from "./artic.js";
import { cleveland } from "./cleveland.js";
import { iconify } from "./iconify.js";
import { linkedProviders } from "./linked.js";
import { loc } from "./loc.js";
import { met } from "./met.js";
import { nasa } from "./nasa.js";
import { openverse } from "./openverse.js";
import { wikimediacommons } from "./wikimediacommons.js";

/**
 * Every built-in provider, in the order results are reported. Originals come
 * before mirrors: when the same image is found twice, de-duplication keeps the
 * copy from the source listed first (a museum's own record before a Commons
 * re-upload of it, Commons before Openverse's copy of it).
 */
export const allProviders: Provider[] = [nasa, met, artic, cleveland, loc, wikimediacommons, iconify, openverse, ...linkedProviders];
