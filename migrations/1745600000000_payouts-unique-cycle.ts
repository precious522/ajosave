import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addConstraint(
    "payouts",
    "unique_payout_per_cycle",
    "UNIQUE (circle_id, cycle_number)"
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint("payouts", "unique_payout_per_cycle");
}
