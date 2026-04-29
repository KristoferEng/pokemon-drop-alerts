import "dotenv/config";
import { runCycle } from "../worker/cycle";

/**
 * First-run seed: do one full scrape cycle so the products table is populated
 * with currently-live SKUs. Without this, the very first real cycle would
 * fire a "new_release" alert for every product that exists today.
 *
 * Run AFTER `npm run db:migrate` and BEFORE starting the worker for the first time.
 */
async function main() {
  process.env.DRY_RUN = "true"; // never text on the seed run, even if creds present
  console.log("Seeding products table from a live scrape (dry run)…");
  await runCycle();
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
