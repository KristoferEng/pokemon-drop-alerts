/**
 * Classifies whether a product title corresponds to a Pokemon TCG product
 * that contains cards/packs (and therefore is alert-worthy).
 *
 * Conservative by design: when uncertain, return false.
 *
 * Returns { isCardProduct, reason } so callers can log decisions.
 */

export type ClassifyResult = { isCardProduct: boolean; reason: string };

const TITLE_NORMALIZE_RE = /[^a-z0-9 ]+/g;

const POKEMON_TERMS = ["pokemon", "pokémon", "pokmon"];

// Strong include signals - if the title contains any of these AND a Pokemon term, alert.
const INCLUDE_TERMS = [
  "booster bundle",
  "booster box",
  "booster pack",
  "booster blister",
  "booster",
  "elite trainer box",
  "etb",
  "premium collection",
  "ultra premium collection",
  "upc",
  "collection box",
  "collector",
  "tin",
  "blister",
  "theme deck",
  "battle deck",
  "starter deck",
  "build battle",
  "build & battle",
  "prerelease",
  "pre-release",
  "trainer box",
  "treasure chest",
  "mystery box",
  "surprise box",
  "league battle deck",
  "v box",
  "vmax box",
  "ex box",
  "tag team",
  "stacking tin",
  "mini tin",
  "pin collection", // these usually include packs
  "pin box",
  "figure collection", // usually includes packs
  "deck box collection",
];

// Hard excludes - even if Pokemon-branded, these don't contain cards
const EXCLUDE_TERMS = [
  "sleeve",
  "sleeves",
  "playmat",
  "play mat",
  "binder",
  "portfolio",
  "deck box", // standalone (note: "deck box collection" matches include first)
  "card storage",
  "storage box",
  "dice",
  "damage counter",
  "coin set", // standalone coins
  "plush",
  "plushie",
  "figure", // standalone figure (note: "figure collection" hits include first)
  "pin set", // standalone pins
  "pin badge",
  "apparel",
  "t-shirt",
  "tshirt",
  "hoodie",
  "hat",
  "cap",
  "backpack",
  "lunchbox",
  "water bottle",
  "mug",
  "poster",
  "art print",
  "puzzle",
  "trading card game online code",
  "tcg live code",
  "code card",
  "video game",
  "nintendo switch",
  "single card",
  "graded card",
  "psa ",
  "cgc ",
  "bgs ",
];

function normalize(s: string): string {
  return s.toLowerCase().replace("é", "e").replace(TITLE_NORMALIZE_RE, " ").replace(/\s+/g, " ").trim();
}

function containsAny(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    if (haystack.includes(n)) return n;
  }
  return null;
}

export function classifyProduct(title: string, category?: string): ClassifyResult {
  const t = normalize(title);
  const c = category ? normalize(category) : "";
  const combined = `${t} ${c}`.trim();

  const hasPokemon = POKEMON_TERMS.some((p) => combined.includes(p));
  if (!hasPokemon) {
    return { isCardProduct: false, reason: "no pokemon term" };
  }

  // Check excludes first - hard reject
  const exclude = containsAny(combined, EXCLUDE_TERMS);
  const include = containsAny(combined, INCLUDE_TERMS);

  // Include wins if it's a more specific match than the exclude
  // (e.g. "deck box collection" should beat "deck box")
  if (include && exclude) {
    if (include.length > exclude.length) {
      return { isCardProduct: true, reason: `include "${include}" beats exclude "${exclude}"` };
    }
    return { isCardProduct: false, reason: `excluded by "${exclude}"` };
  }

  if (exclude) {
    return { isCardProduct: false, reason: `excluded by "${exclude}"` };
  }

  if (include) {
    return { isCardProduct: true, reason: `included by "${include}"` };
  }

  // Generic "Pokemon TCG" or "Pokemon Trading Card Game" without specifics → likely a card product
  if (combined.includes("trading card game") || combined.includes(" tcg")) {
    return { isCardProduct: true, reason: "generic tcg product" };
  }

  // Default: uncertain → exclude (better to miss than spam)
  return { isCardProduct: false, reason: "uncertain - default exclude" };
}
