export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    if (process.env.NODE_ENV === "production") {
      const { default: runner } = await import("node-pg-migrate");
      const path = await import("path");
      await runner({
        databaseUrl: process.env.DATABASE_URL!,
        dir: path.join(process.cwd(), "migrations"),
        direction: "up",
        migrationsTable: "pgmigrations",
        log: (msg) => console.log("[migrate]", msg),
      });
    }

    // Initialize background services (Horizon stream, etc.)
    const { initializeServices } = await import("./src/server/startup");
    await initializeServices();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
