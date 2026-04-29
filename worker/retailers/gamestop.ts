import * as cheerio from "cheerio";
import { fetchText } from "../http";
import type { RetailerScraper, ScrapedProduct } from "../types";

/**
 * GameStop's category page for Pokemon TCG. We page through their search-results
 * partial endpoint which returns plain HTML.
 */

const BASE = "https://www.gamestop.com";
const SEARCH = `${BASE}/search/?q=pokemon+tcg&start=`;

export const gamestop: RetailerScraper = {
  id: "gamestop",
  async scrape() {
    const out: ScrapedProduct[] = [];
    const seen = new Set<string>();
    const pageSize = 24;
    for (let start = 0; start < 600; start += pageSize) {
      let html: string;
      try {
        html = await fetchText(`${SEARCH}${start}&sz=${pageSize}`, {
          timeoutMs: 20_000,
          headers: { "x-requested-with": "XMLHttpRequest" },
        });
      } catch {
        break;
      }
      const $ = cheerio.load(html);
      const tiles = $("div.product-tile, .product");
      if (tiles.length === 0) break;

      let foundOnPage = 0;
      tiles.each((_, el) => {
        const $el = $(el);
        const a =
          $el.find("a.tile-image-anchor, a.product-tile__title-link, a.link").first();
        const href = a.attr("href");
        const name =
          $el.find(".product-tile__title, .product-name, .pdp-link a").text().trim() ||
          a.attr("title") ||
          a.text().trim();
        const oos = $el.find(".product-tile__out-of-stock, .out-of-stock").length > 0;
        const button = $el.find("button, a.btn").text().toLowerCase();
        const inStock = !oos && !/sold out|out of stock|notify me|coming soon/i.test(button);
        if (!href || !name) return;
        const url = href.startsWith("http") ? href : `${BASE}${href}`;
        if (seen.has(url)) return;
        seen.add(url);
        foundOnPage++;
        out.push({
          retailer: "gamestop",
          productUrl: url,
          productName: name,
          inStock,
        });
      });
      if (foundOnPage === 0) break;
    }
    return out;
  },
};
