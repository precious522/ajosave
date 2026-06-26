import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("circles", {
    fee_bumps_usdc: { type: "numeric(20, 7)", notNull: true, default: 0 },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("circles", "fee_bumps_usdc");
}
