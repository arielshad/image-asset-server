import { creativeCommons, license } from "../src/core/licence.js";
import type { ImageDetails, HttpClient, Provider } from "../src/core/types.js";
import { filterLocal, makeImage, paginate } from "../src/core/util.js";

/** A CC0 4K landscape ocean photo: original, two resized copies and a thumbnail. */
export const OCEAN: ImageDetails = {
  ...makeImage({
    provider: "fake",
    nativeId: "ocean",
    title: "Ocean Waves at Sunset",
    tags: ["ocean", "waves", "sunset"],
    url: "https://fake.example/ocean",
    thumbnailUrl: "https://cdn.fake.example/ocean-330.jpg",
    previewUrl: "https://cdn.fake.example/ocean-1280.jpg",
    license: license("CC0-1.0"),
    price: { free: true },
    styles: ["photo"],
    width: 3840,
    height: 2160,
    formats: ["tif", "jpg"],
    downloadable: true,
  }),
  files: [
    { url: "https://cdn.fake.example/ocean-330.jpg", filename: "ocean-330.jpg", format: "jpg", role: "thumbnail", width: 330, height: 186, sizeBytes: 4 },
    { url: "https://cdn.fake.example/ocean.tif", filename: "ocean.tif", format: "tif", role: "original", width: 3840, height: 2160, sizeBytes: 4 },
    { url: "https://cdn.fake.example/ocean-1920.jpg", filename: "ocean-1920.jpg", format: "jpg", role: "rendition", width: 1920, height: 1080, sizeBytes: 4 },
    { url: "https://cdn.fake.example/ocean-1280.jpg", filename: "ocean-1280.jpg", format: "jpg", role: "rendition", width: 1280, height: 720, sizeBytes: 4 },
  ],
};

/** A CC BY-NC vertical city photo: never commercial-safe. */
export const CITY: ImageDetails = {
  ...makeImage({
    provider: "fake",
    nativeId: "city",
    title: "City Traffic at Night",
    tags: ["city", "traffic", "night"],
    url: "https://fake.example/city",
    thumbnailUrl: "https://cdn.fake.example/city-thumb.jpg",
    previewUrl: "https://cdn.fake.example/city.jpg",
    license: creativeCommons({ nc: true }),
    price: { free: true },
    width: 1080,
    height: 1920,
    downloadable: true,
  }),
  files: [{ url: "https://cdn.fake.example/city.jpg", filename: "city.jpg", format: "jpg", role: "original", width: 1080, height: 1920, sizeBytes: 4 }],
};

/** An MIT-licensed SVG icon. */
export const STAR: ImageDetails = {
  ...makeImage({
    provider: "fake",
    nativeId: "star",
    title: "Star icon",
    tags: ["star", "icon"],
    url: "https://fake.example/star",
    thumbnailUrl: "https://cdn.fake.example/star.svg",
    previewUrl: "https://cdn.fake.example/star.svg",
    category: "icons",
    styles: ["icon", "vector"],
    vector: true,
    transparent: true,
    width: 24,
    height: 24,
    formats: ["svg"],
    license: license("MIT"),
    price: { free: true },
    downloadable: true,
  }),
  files: [{ url: "https://cdn.fake.example/star.svg", filename: "star.svg", format: "svg", role: "original", width: 24, height: 24, sizeBytes: 4 }],
};

/** A image whose files need an account. */
const ROCKET = makeImage({
  provider: "fake",
  nativeId: "rocket",
  title: "Rocket Launch",
  tags: ["rocket", "launch"],
  url: "https://fake.example/rocket",
  license: license("CC0-1.0"),
  price: { free: true },
  downloadable: false,
});

export const fakeProvider: Provider = {
  id: "fake",
  name: "Fake",
  homepage: "https://fake.example",
  description: "Test provider",
  categories: ["nature", "city", "space", "icons"],
  access: "api",
  pricing: "free",
  supportsDownload: true,
  buildSearchUrl: (q) => `https://fake.example/search?q=${encodeURIComponent(q.query)}`,
  async search(q) {
    const items = filterLocal([OCEAN, CITY, STAR, ROCKET], q);
    return { images: paginate(items, q), total: items.length };
  },
  async getImage(id) {
    return id === "ocean" ? OCEAN : id === "city" ? CITY : id === "star" ? STAR : null;
  },
};

export const brokenProvider: Provider = {
  ...fakeProvider,
  id: "broken",
  name: "Broken",
  getImage: undefined,
  async search() {
    throw new Error("boom");
  },
};

export const slowProvider: Provider = {
  ...fakeProvider,
  id: "slow",
  name: "Slow",
  search: () => new Promise(() => undefined),
};

/** HttpClient that serves the bytes "data:<file>" for any URL and records requests. */
export function bytesHttp(): HttpClient & { requests: string[] } {
  const requests: string[] = [];
  const body = (url: string) => new TextEncoder().encode(`data:${url.slice(url.lastIndexOf("/") + 1)}`);
  return {
    requests,
    async raw(url) {
      requests.push(url);
      return new Response(body(url));
    },
    async text(url) {
      requests.push(url);
      return new TextDecoder().decode(body(url));
    },
    async json() {
      throw new Error("not used");
    },
  };
}
