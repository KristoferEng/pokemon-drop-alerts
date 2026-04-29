import { pokemoncenter } from "./pokemoncenter";
import { target } from "./target";
import { walmart } from "./walmart";
import { bestbuy } from "./bestbuy";
import { gamestop } from "./gamestop";
import { costco } from "./costco";
import type { RetailerScraper } from "../types";

export const SCRAPERS: RetailerScraper[] = [
  pokemoncenter,
  target,
  walmart,
  bestbuy,
  gamestop,
  costco,
];
