export type RetailerId =
  | "pokemoncenter"
  | "target"
  | "walmart"
  | "bestbuy"
  | "gamestop"
  | "costco";

export const RETAILER_DOMAIN: Record<RetailerId, string> = {
  pokemoncenter: "pokemoncenter.com",
  target: "target.com",
  walmart: "walmart.com",
  bestbuy: "bestbuy.com",
  gamestop: "gamestop.com",
  costco: "costco.com",
};

export type ScrapedProduct = {
  retailer: RetailerId;
  productUrl: string;
  productName: string;
  inStock: boolean;
  category?: string;
};

export type RetailerScraper = {
  id: RetailerId;
  scrape: () => Promise<ScrapedProduct[]>;
};
