import * as cheerio from "cheerio";
import { fetchText } from "../http";
import type { RetailerScraper, ScrapedProduct } from "../types";

/**
 * Walmart actively blocks scraping. We try the public search HTML, parse the
 * `__NEXT_DATA__` blob, and best-effort enumerate Pokemon TCG products.
 *
 * Set WALMART_PROXY_URL in env to route through a residential proxy if direct
 * requests start failing (recommended for production).
 */

const PROXY = process.env.WALMART_PROXY_URL;

const SEARCH_URL = "https://www.walmart.com/search?q=pokemon+tcg&sort=best_match";

type NextDataItem = {
  __typename?: string;
  usItemId?: string;
  name?: string;
  canonicalUrl?: string;
  availabilityStatusV2?: { display?: string; value?: string };
  fulfillmentBadge?: string;
  category?: { path?: Array<{ name: string }> };
};

function dig(obj: unknown, predicate: (n: unknown) => boolean, out: unknown[] = []): unknown[] {
  if (!obj || typeof obj !== "object") return out;
  if (predicate(obj)) out.push(obj);
  for (const v of Object.values(obj as Record<string, unknown>)) dig(v, predicate, out);
  return out;
}

export const walmart: RetailerScraper = {
  id: "walmart",
  async scrape() {
    const out: ScrapedProduct[] = [];
    const seen = new Set<string>();
    const url = PROXY ? `${PROXY}?url=${encodeURIComponent(SEARCH_URL)}` : SEARCH_URL;
    let html: string;
    try {
      html = await fetchText(url, { timeoutMs: 25_000 });
    } catch {
      return [];
    }
    const $ = cheerio.load(html);
    const blob = $("script#__NEXT_DATA__").text();
    if (!blob) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(blob);
    } catch {
      return [];
    }

    const items = dig(parsed, (n) => {
      if (!n || typeof n !== "object") return false;
      const o = n as NextDataItem;
      return Boolean(o.usItemId && o.name && o.canonicalUrl);
    }) as NextDataItem[];

    for (const item of items) {
      if (!item.canonicalUrl || !item.name) continue;
      const url = item.canonicalUrl.startsWith("http")
        ? item.canonicalUrl
        : `https://www.walmart.com${item.canonicalUrl}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const status =
        item.availabilityStatusV2?.value ?? item.availabilityStatusV2?.display ?? "";
      const inStock = /in.?stock|available/i.test(status);
      out.push({
        retailer: "walmart",
        productUrl: url,
        productName: item.name,
        inStock,
        category: item.category?.path?.map((p) => p.name).join(" > "),
      });
    }
    return out;
  },
};
