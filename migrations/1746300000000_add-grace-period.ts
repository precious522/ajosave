import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("circles", {
    grace_period_hours: {
      type: "integer",
      notNull: true,
      default: 24,
      check: "grace_period_hours >= 0 AND grace_period_hours <= 168",
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("circles", "grace_period_hours");
}
