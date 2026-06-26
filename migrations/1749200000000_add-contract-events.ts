/**
 * Migration: contract_events + indexer_state tables (Issue #132)
 *
 * contract_events — append-only log of indexed Soroban contract events.
 *   Unique on (tx_hash, topic) to deduplicate re-processed ledgers.
 *
 * indexer_state — one row per contract; stores the last successfully
 *   indexed ledger so the poller resumes from where it left off.
 */
import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("contract_events", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    contract_id: { type: "varchar(255)", notNull: true },
    tx_hash: { type: "varchar(255)", notNull: true },
    topic: { type: "varchar(50)", notNull: true },
    payload: { type: "jsonb", notNull: true, default: "'{}'::jsonb" },
    ledger: { type: "integer", notNull: true },
    ledger_timestamp: { type: "timestamp" },
    processed: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("contract_events", "contract_events_tx_topic_unique", "UNIQUE (tx_hash, topic)");
  pgm.createIndex("contract_events", "contract_id");
  pgm.createIndex("contract_events", "topic");
  pgm.createIndex("contract_events", "processed");
  pgm.createIndex("contract_events", "ledger");

  pgm.createTable("indexer_state", {
    contract_id: { type: "varchar(255)", primaryKey: true },
    last_indexed_ledger: { type: "integer", notNull: true, default: 0 },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("indexer_state");
  pgm.dropTable("contract_events");
}
