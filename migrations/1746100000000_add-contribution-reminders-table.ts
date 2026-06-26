import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("contribution_reminders", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    member_id: {
      type: "uuid",
      notNull: true,
      references: "members(id)",
      onDelete: "CASCADE",
    },
    cycle_number: { type: "integer", notNull: true, check: "cycle_number > 0" },
    reminder_type: {
      type: "varchar(4)",
      notNull: true,
      check: "reminder_type IN ('24h', '2h')",
    },
    sent_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint(
    "contribution_reminders",
    "unique_contribution_reminder",
    "UNIQUE (member_id, cycle_number, reminder_type)"
  );

  pgm.createIndex("contribution_reminders", ["member_id", "cycle_number"], {
    name: "idx_contribution_reminders_member",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("contribution_reminders");
}
