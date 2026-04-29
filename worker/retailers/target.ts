import { fetchJson } from "../http";
import type { RetailerScraper, ScrapedProduct } from "../types";

/**
 * Target's redsky API powers their site search. It's publicly callable but
 * needs a `key` parameter and a `visitor_id`. The key occasionally rotates;
 * override via env TARGET_REDSKY_KEY if needed.
 *
 * We search the "Pokemon TCG" category via keyword.
 */

const REDSKY_KEY = process.env.TARGET_REDSKY_KEY ?? "9f36aeafbe60771e321a7cc95a78140772ab3e96";

type RedskyResponse = {
  data: {
    search: {
      products?: Array<{
        tcin: string;
        item: {
          enrichment?: { buy_url?: string };
          product_description?: { title?: string };
          merchandise_classification?: { class_name?: string };
        };
        price?: { current_retail?: number };
        fulfillment?: {
          shipping_options?: { availability_status?: string };
          available_to_promise_network?: { availability_status?: string };
        };
      }>;
      search_response?: { metadata?: { total_results?: number } };
    };
  };
};

function buildUrl(p: NonNullable<RedskyResponse["data"]["search"]["products"]>[number]): string | null {
  if (p.item.enrichment?.buy_url) return p.item.enrichment.buy_url;
  return `https://www.target.com/p/-/A-${p.tcin}`;
}

function isInStock(p: NonNullable<RedskyResponse["data"]["search"]["products"]>[number]): boolean {
  const ship = p.fulfillment?.shipping_options?.availability_status ?? "";
  const network = p.fulfillment?.available_to_promise_network?.availability_status ?? "";
  return /in.?stock|available/i.test(ship) || /in.?stock|available/i.test(network);
}

export const target: RetailerScraper = {
  id: "target",
  async scrape() {
    const out: ScrapedProduct[] = [];
    const seen = new Set<string>();
    const visitorId = "0192" + Math.random().toString(16).slice(2, 14).toUpperCase();
    let offset = 0;
    const pageSize = 24;
    let total = 1;

    while (offset < total && offset < 600) {
      const params = new URLSearchParams({
        key: REDSKY_KEY,
        category: "5xsxr", // Pokémon TCG category id (may need update)
        channel: "WEB",
        count: String(pageSize),
        default_purchasability_filter: "false",
        offset: String(offset),
        page: "/c/5xsxr",
        platform: "desktop",
        pricing_store_id: "865",
        scheduled_delivery_store_id: "865",
        store_ids: "865,1771,1957,1289,1245",
        useragent: "Mozilla/5.0",
        visitor_id: visitorId,
      });

      let resp: RedskyResponse;
      try {
        resp = await fetchJson<RedskyResponse>(
          `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?${params}`,
          { timeoutMs: 20_000 },
        );
      } catch {
        // Fallback: keyword search
        const kparams = new URLSearchParams({
          key: REDSKY_KEY,
          channel: "WEB",
          count: String(pageSize),
          default_purchasability_filter: "false",
          keyword: "pokemon tcg",
          offset: String(offset),
          page: "/s/pokemon+tcg",
          platform: "desktop",
          pricing_store_id: "865",
          visitor_id: visitorId,
        });
        resp = await fetchJson<RedskyResponse>(
          `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?${kparams}`,
          { timeoutMs: 20_000 },
        );
      }

      const products = resp.data?.search?.products ?? [];
      total = resp.data?.search?.search_response?.metadata?.total_results ?? offset + products.length;

      if (products.length === 0) break;

      for (const p of products) {
        const url = buildUrl(p);
        const name = p.item.product_description?.title;
        if (!url || !name) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        out.push({
          retailer: "target",
          productUrl: url,
          productName: name,
          inStock: isInStock(p),
          category: p.item.merchandise_classification?.class_name,
        });
      }

      offset += pageSize;
    }
    return out;
  },
};
