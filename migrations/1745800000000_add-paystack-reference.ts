import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("contributions", {
    paystack_reference: { type: "varchar(255)", unique: true },
  });
  pgm.addConstraint(
    "contributions",
    "unique_contribution_per_member_cycle",
    "UNIQUE (member_id, cycle_number)"
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint("contributions", "unique_contribution_per_member_cycle");
  pgm.dropColumn("contributions", "paystack_reference");
}
