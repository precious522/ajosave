import { runner } from "node-pg-migrate";
import path from "path";
import pkg from "@next/env";
const { loadEnvConfig } = pkg;

loadEnvConfig(process.cwd());

const direction = (process.argv[2] ?? "up") as "up" | "down";

if (direction !== "up" && direction !== "down") {
  console.error('Usage: ts-node scripts/migrate.ts [up|down]');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

runner({
  databaseUrl,
  dir: path.join(__dirname, "../migrations"),
  direction,
  migrationsTable: "pgmigrations",
  count: direction === "down" ? 1 : Infinity,
  log: (msg: string) => console.log(msg),
})
  .then(() => {
    console.log(`Migrations (${direction}) complete`);
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
