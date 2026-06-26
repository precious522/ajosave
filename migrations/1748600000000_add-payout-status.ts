import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("payouts")
    .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("completed"))
    .addColumn("retry_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("payouts")
    .dropColumn("status")
    .dropColumn("retry_count")
    .dropColumn("last_error")
    .execute();
}
