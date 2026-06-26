import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("users", {
    id: { type: "varchar(255)", primaryKey: true },
    phone: { type: "varchar(20)", notNull: true, unique: true },
    display_name: { type: "varchar(255)", notNull: true },
    email: { type: "varchar(255)" },
    stellar_public_key: { type: "varchar(56)" },
    reputation_score: {
      type: "integer",
      notNull: true,
      default: 0,
      check: "reputation_score >= 0 AND reputation_score <= 100",
    },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("users", "phone");

  pgm.createTable("circles", {
    id: { type: "uuid", primaryKey: true },
    name: { type: "varchar(255)", notNull: true },
    creator_id: { type: "varchar(255)", notNull: true },
    contribution_usdc: { type: "numeric(20,7)", notNull: true },
    contribution_ngn: { type: "numeric(20,2)", notNull: true },
    max_members: { type: "integer", notNull: true, check: "max_members > 0" },
    cycle_frequency: {
      type: "varchar(20)",
      notNull: true,
      check: "cycle_frequency IN ('weekly','biweekly','monthly')",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "open",
      check: "status IN ('open','active','completed','cancelled')",
    },
    contract_id: { type: "varchar(255)" },
    current_cycle: { type: "integer", notNull: true, default: 0 },
    next_payout_at: { type: "timestamp" },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("circles", "status");
  pgm.createIndex("circles", "creator_id");

  pgm.createTable("members", {
    id: { type: "uuid", primaryKey: true },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    user_id: { type: "varchar(255)", notNull: true },
    position: { type: "integer", notNull: true, check: "position > 0" },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "pending",
      check: "status IN ('pending','active','defaulted','completed')",
    },
    has_received_payout: { type: "boolean", notNull: true, default: false },
    joined_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("members", "circle_id");
  pgm.createIndex("members", "user_id");
  pgm.createIndex("members", "status");
  pgm.addConstraint("members", "unique_member_per_circle", "UNIQUE (circle_id, user_id)");

  pgm.createTable("contributions", {
    id: { type: "uuid", primaryKey: true },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    member_id: {
      type: "uuid",
      notNull: true,
      references: "members(id)",
      onDelete: "CASCADE",
    },
    cycle_number: { type: "integer", notNull: true, check: "cycle_number > 0" },
    amount_usdc: { type: "numeric(20,7)", notNull: true },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "pending",
      check: "status IN ('pending','confirmed','missed')",
    },
    tx_hash: { type: "varchar(255)" },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("contributions", "circle_id");
  pgm.createIndex("contributions", "member_id");
  pgm.createIndex("contributions", "status");

  pgm.createTable("payouts", {
    id: { type: "uuid", primaryKey: true },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    recipient_member_id: {
      type: "uuid",
      notNull: true,
      references: "members(id)",
      onDelete: "RESTRICT",
    },
    cycle_number: { type: "integer", notNull: true, check: "cycle_number > 0" },
    amount_usdc: { type: "numeric(20,7)", notNull: true },
    tx_hash: { type: "varchar(255)", notNull: true, unique: true },
    paid_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("payouts", "circle_id");
  pgm.createIndex("payouts", "recipient_member_id");
  pgm.createIndex("payouts", "paid_at");
  pgm.createIndex("payouts", ["circle_id", "cycle_number"]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("payouts");
  pgm.dropTable("contributions");
  pgm.dropTable("members");
  pgm.dropTable("circles");
  pgm.dropTable("users");
}
