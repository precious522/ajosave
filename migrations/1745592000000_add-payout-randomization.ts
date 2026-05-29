import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Add payout_method and randomization_seed columns to circles table
  await db.schema
    .alterTable("circles")
    .addColumn("payout_method", "varchar(20)", (col) =>
      col.notNull().defaultTo("fixed")
    )
    .addColumn("randomization_seed", "varchar(255)")
    .execute();

  // Add updated_at column to members table
  await db.schema
    .alterTable("members")
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(db.fn("now"))
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("circles")
    .dropColumn("payout_method")
    .dropColumn("randomization_seed")
    .execute();

  await db.schema
    .alterTable("members")
    .dropColumn("updated_at")
    .execute();
}
