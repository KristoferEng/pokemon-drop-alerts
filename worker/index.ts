import "dotenv/config";
import { runCycle } from "./cycle";
import { log } from "../lib/log";

const CYCLE_SECONDS = Number(process.env.WORKER_CYCLE_SECONDS ?? 180);
const RUN_ONCE = process.env.RUN_ONCE === "1";

async function main() {
  log.info("worker.start", {
    cycleSeconds: CYCLE_SECONDS,
    dryRun: process.env.DRY_RUN === "true",
    runOnce: RUN_ONCE,
  });

  if (RUN_ONCE) {
    await runCycle();
    log.info("worker.run_once_done");
    process.exit(0);
  }

  let stopping = false;
  process.on("SIGTERM", () => {
    log.info("worker.sigterm");
    stopping = true;
  });
  process.on("SIGINT", () => {
    log.info("worker.sigint");
    stopping = true;
  });

  while (!stopping) {
    try {
      await runCycle();
    } catch (err) {
      log.error("cycle.uncaught", { err: String(err) });
    }
    if (stopping) break;
    // Jitter the wait by ±20% so multiple workers don't sync up
    const base = CYCLE_SECONDS * 1000;
    const wait = base + (Math.random() - 0.5) * base * 0.4;
    await new Promise((r) => setTimeout(r, wait));
  }
  log.info("worker.stop");
  process.exit(0);
}

main().catch((err) => {
  log.error("worker.fatal", { err: String(err) });
  process.exit(1);
});
