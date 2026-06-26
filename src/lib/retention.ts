import { query } from "./db";

const RETENTION = {
  pii: 2 * 365 * 24 * 60 * 60 * 1000,
  auditLogs: 7 * 365 * 24 * 60 * 60 * 1000,
};

export async function purgeExpiredPii(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION.pii).toISOString();
  const deleteUsers = await query("DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < $1", [cutoff]);
  const deleteAuditLogs = await query("DELETE FROM audit_logs WHERE created_at < $1", [new Date(Date.now() - RETENTION.auditLogs).toISOString()]);

  return Number(deleteUsers.rowCount ?? 0) + Number(deleteAuditLogs.rowCount ?? 0);
}

export function anonymizeAuditActor(actor: string): string {
  return actor ? `deleted-user-${actor.length}` : "deleted-user";
}
