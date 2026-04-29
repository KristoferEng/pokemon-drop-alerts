import { fetchJson } from "../http";
import type { RetailerScraper, ScrapedProduct } from "../types";

/**
 * pokemoncenter.com uses Algolia for product search. The TCG category indexes
 * are publicly queryable via their public Algolia frontend keys.
 *
 * We hit their multi-query endpoint to enumerate all TCG products and their
 * stock state (the `outOfStock` Algolia attribute).
 *
 * NOTE: The Algolia app id and api key are extracted from the public page bundle.
 * If pokemoncenter rotates them, update via env: POKEMON_CENTER_ALGOLIA_APP_ID /
 * POKEMON_CENTER_ALGOLIA_API_KEY / POKEMON_CENTER_ALGOLIA_INDEX.
 */

const APP_ID = process.env.POKEMON_CENTER_ALGOLIA_APP_ID ?? "VEVTPY1V3R";
const API_KEY =
  process.env.POKEMON_CENTER_ALGOLIA_API_KEY ??
  "ee47ccc23e7e0fcb1f2a5bddaba9c25b";
const INDEX = process.env.POKEMON_CENTER_ALGOLIA_INDEX ?? "prod_products";

type AlgoliaHit = {
  objectID: string;
  productName?: string;
  name?: string;
  url?: string;
  slug?: string;
  outOfStock?: boolean;
  stockLevelStatus?: string;
  stock?: { stockLevelStatus?: string };
  category?: string[] | string;
  productTypeFromCategory?: string;
};

type AlgoliaResponse = {
  results: Array<{
    hits: AlgoliaHit[];
    nbPages: number;
    page: number;
  }>;
};

async function queryPage(page: number): Promise<AlgoliaResponse["results"][0]> {
  const body = {
    requests: [
      {
        indexName: INDEX,
        params: new URLSearchParams({
          hitsPerPage: "100",
          page: String(page),
          facetFilters: JSON.stringify([
            ["productTypeFromCategory:Trading Card Game"],
          ]),
          attributesToRetrieve: JSON.stringify([
            "objectID",
            "productName",
            "name",
            "url",
            "slug",
            "outOfStock",
            "stockLevelStatus",
            "stock",
            "category",
            "productTypeFromCategory",
          ]),
        }).toString(),
      },
    ],
  };

  const res = await fetchJson<AlgoliaResponse>(
    `https://${APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`,
    {
      method: "POST",
      headers: {
        "x-algolia-application-id": APP_ID,
        "x-algolia-api-key": API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      timeoutMs: 20_000,
    },
  );
  return res.results[0];
}

function buildUrl(hit: AlgoliaHit): string | null {
  if (hit.url && hit.url.startsWith("http")) return hit.url;
  if (hit.url) return `https://www.pokemoncenter.com${hit.url}`;
  if (hit.slug) return `https://www.pokemoncenter.com/product/${hit.slug}`;
  return null;
}

function isInStock(hit: AlgoliaHit): boolean {
  if (hit.outOfStock === true) return false;
  if (hit.outOfStock === false) return true;
  const status = hit.stockLevelStatus ?? hit.stock?.stockLevelStatus ?? "";
  return /in.?stock|available/i.test(status);
}

export const pokemoncenter: RetailerScraper = {
  id: "pokemoncenter",
  async scrape() {
    const out: ScrapedProduct[] = [];
    const seen = new Set<string>();
    let page = 0;
    let totalPages = 1;
    while (page < totalPages && page < 25) {
      const result = await queryPage(page);
      totalPages = result.nbPages;
      for (const hit of result.hits) {
        const url = buildUrl(hit);
        const name = hit.productName ?? hit.name ?? "";
        if (!url || !name) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        const category = Array.isArray(hit.category)
          ? hit.category.join(", ")
          : (hit.category ?? hit.productTypeFromCategory);
        out.push({
          retailer: "pokemoncenter",
          productUrl: url,
          productName: name,
          inStock: isInStock(hit),
          category,
        });
      }
      page++;
    }
    return out;
  },
};
