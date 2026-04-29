import { fetchJson } from "../http";
import type { RetailerScraper, ScrapedProduct } from "../types";

/**
 * Best Buy publishes a free Products API. Get a key at developer.bestbuy.com.
 * Set BESTBUY_API_KEY in env.
 *
 * If no key is set, this scraper returns [] silently — log warning at startup.
 */

const KEY = process.env.BESTBUY_API_KEY;

type BestBuyProduct = {
  sku: number;
  name: string;
  url: string;
  inStoreAvailability?: boolean;
  onlineAvailability?: boolean;
  categoryPath?: Array<{ name: string }>;
};

type BestBuyResponse = {
  products: BestBuyProduct[];
  totalPages: number;
  currentPage: number;
};

export const bestbuy: RetailerScraper = {
  id: "bestbuy",
  async scrape() {
    if (!KEY) return [];
    const out: ScrapedProduct[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 20) {
      const params = new URLSearchParams({
        apiKey: KEY,
        format: "json",
        pageSize: "100",
        page: String(page),
        show: "sku,name,url,onlineAvailability,inStoreAvailability,categoryPath.name",
        sort: "name.asc",
      });
      // Search by manufacturer + category for Pokemon TCG
      const query = "(search=pokemon&search=tcg)|(search=pokemon&search=trading+card)";
      const url = `https://api.bestbuy.com/v1/products(${query})?${params}`;
      const res = await fetchJson<BestBuyResponse>(url, { timeoutMs: 20_000 });
      totalPages = res.totalPages;
      for (const p of res.products) {
        out.push({
          retailer: "bestbuy",
          productUrl: p.url,
          productName: p.name,
          inStock: !!p.onlineAvailability,
          category: p.categoryPath?.map((c) => c.name).join(" > "),
        });
      }
      page++;
    }
    return out;
  },
};
