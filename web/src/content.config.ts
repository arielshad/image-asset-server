/**
 * Content collections. `collections` are the curated image pages under
 * /collections/<slug>: editorial copy and a saved search, one Markdown file each.
 * Their results come from web/src/data/collections/<slug>.json, refreshed by
 * scripts/snapshot-collections.mjs. scripts/lib/topics.mjs checks the same
 * files against the editorial rules (lengths, related pages, FAQ); the search
 * shape matches `CollectionSearch` in src/core/collections.ts.
 * Categories, styles and orientations come from the server's vocabulary
 * (src/data/vocab.json).
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import vocab from "./data/vocab.json";

const CATEGORIES = vocab.categories.map((c) => c.id) as [string, ...string[]];
const STYLES = vocab.styles.map((s) => s.id) as [string, ...string[]];
const ORIENTATIONS = vocab.orientations as [string, ...string[]];

const imageCollections = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/collections" }),
  schema: z.object({
    title: z.string().min(10).max(60),
    description: z.string().min(110).max(160),
    hub: z.string(),
    search: z
      .object({
        q: z.string().min(2).max(60),
        categories: z.array(z.enum(CATEGORIES)).min(1).optional(),
        styles: z.array(z.enum(STYLES)).min(1).optional(),
        orientations: z.array(z.enum(ORIENTATIONS)).min(1).optional(),
        /** Minimum short side in pixels. */
        minResolution: z.union([z.literal(720), z.literal(1080), z.literal(1440), z.literal(2160)]).optional(),
        free: z.boolean().optional(),
        commercial: z.boolean().optional(),
        downloadable: z.boolean().optional(),
        providers: z.array(z.string()).optional(),
        exclude: z.array(z.string().max(60)).max(30).optional(),
      })
      .strict(),
    aliases: z.array(z.string().max(60)).optional(),
    related: z.array(z.string()).min(2).max(6),
    faq: z.array(z.object({ q: z.string().endsWith("?"), a: z.string().min(40).max(450) })).min(2).max(5),
    addedAt: z.coerce.date(),
    addedBy: z.enum(["human", "agent"]),
  }),
});

/**
 * Guides (/guides/<slug>): answer-first articles for designers, writers and AI
 * assistants. `answer` is the short, quotable reply shown at the top of the
 * page (and as the Article's abstract); `steps` makes it a HowTo; `faq` adds
 * a FAQPage. Links in `searches` must be internal (/search?…).
 */
const guides = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/guides" }),
  schema: z.object({
    title: z.string().min(10).max(70),
    /** <title> when the H1 is too long for one (at most 55 characters + " · Image Asset Server"). */
    seoTitle: z.string().min(10).max(55).optional(),
    description: z.string().min(110).max(160),
    answer: z.string().min(80).max(700),
    section: z.enum(["Licensing", "Production", "AI agents"]),
    kind: z.enum(["article", "howto"]).default("article"),
    steps: z.array(z.object({ name: z.string(), text: z.string() })).min(3).optional(),
    faq: z.array(z.object({ q: z.string().endsWith("?"), a: z.string().min(40).max(600) })).max(6).default([]),
    searches: z.array(z.object({ label: z.string(), href: z.string().startsWith("/") })).default([]),
    collections: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    cites: z.array(z.object({ name: z.string(), url: z.url() })).default([]),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    order: z.number(),
  }),
});

export const collections = { collections: imageCollections, guides };
