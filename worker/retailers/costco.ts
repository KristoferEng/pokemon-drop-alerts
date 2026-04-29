import * as cheerio from "cheerio";
import { fetchText } from "../http";
import type { RetailerScraper, ScrapedProduct } from "../types";

/**
 * Costco doesn't expose a clean search API. We hit their search page HTML.
 * Their TCG inventory is small and rotates fast, so this is best-effort.
 */

const BASE = "https://www.costco.com";
const SEARCH = `${BASE}/CatalogSearch?dept=All&keyword=pokemon`;

export const costco: RetailerScraper = {
  id: "costco",
  async scrape() {
    const out: ScrapedProduct[] = [];
    const seen = new Set<string>();
    let html: string;
    try {
      html = await fetchText(SEARCH, { timeoutMs: 20_000 });
    } catch {
      return [];
    }
    const $ = cheerio.load(html);
    $("div.product, .product-tile-set").each((_, el) => {
      const $el = $(el);
      const a = $el.find("a.product-name-url, .description a, a[automation-id='productDescription']").first();
      const href = a.attr("href");
      const name = a.text().trim();
      if (!href || !name) return;
      const url = href.startsWith("http") ? href : `${BASE}${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      const text = $el.text().toLowerCase();
      const inStock = !/out of stock|sold out|notify me|currently unavailable/i.test(text);
      out.push({
        retailer: "costco",
        productUrl: url,
        productName: name,
        inStock,
      });
    });
    return out;
  },
};
