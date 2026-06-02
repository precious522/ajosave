import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Track how much has actually been paid so far (running total)
  pgm.addColumn("contributions", {
    amount_paid_usdc: {
      type: "NUMERIC(20, 7)",
      notNull: true,
      default: 0,
    },
  });

  // Flag whether this contribution was ever partially paid
  pgm.addColumn("contributions", {
    is_partial: {
      type: "BOOLEAN",
      notNull: true,
      default: false,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("contributions", "amount_paid_usdc");
  pgm.dropColumn("contributions", "is_partial");
}
