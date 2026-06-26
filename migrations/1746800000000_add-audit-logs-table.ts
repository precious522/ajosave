import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create function to prevent modifications (must be created before trigger)
  pgm.sql(`
    CREATE OR REPLACE FUNCTION raise_immutable_error()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create audit_logs table for immutable audit trail
  pgm.createTable("audit_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    actor_id: {
      type: "varchar(255)",
      notNull: true,
      references: "users(id)",
      onDelete: "RESTRICT",
    },
    action: {
      type: "varchar(50)",
      notNull: true,
      check: "action IN ('TRIGGER_PAYOUT', 'REMOVE_MEMBER', 'DELETE_USER', 'DELETE_CIRCLE', 'UPDATE_CIRCLE', 'OTHER')",
    },
    target_type: {
      type: "varchar(50)",
      notNull: true,
      check: "target_type IN ('CIRCLE', 'MEMBER', 'USER', 'PAYOUT', 'OTHER')",
    },
    target_id: {
      type: "varchar(255)",
      notNull: true,
    },
    details: {
      type: "jsonb",
      default: "'{}'::jsonb",
    },
    ip_address: {
      type: "varchar(45)",
    },
    user_agent: {
      type: "text",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Indexes for efficient querying
  pgm.createIndex("audit_logs", "actor_id");
  pgm.createIndex("audit_logs", "action");
  pgm.createIndex("audit_logs", "target_type");
  pgm.createIndex("audit_logs", "target_id");
  pgm.createIndex("audit_logs", "created_at");
  pgm.createIndex("audit_logs", ["actor_id", "created_at"]);
  pgm.createIndex("audit_logs", ["action", "created_at"]);

  // Prevent updates and deletes on audit_logs table
  pgm.sql(`
    CREATE TRIGGER audit_logs_immutable
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION raise_immutable_error();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTrigger("audit_logs", "audit_logs_immutable");
  pgm.dropFunction("raise_immutable_error", []);
  pgm.dropTable("audit_logs");
}
