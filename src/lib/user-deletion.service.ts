import { query } from "./db";
import { anonymizeAuditActor } from "./retention";

export async function deleteUserAccount(userId: string): Promise<void> {
  await query("UPDATE users SET deleted_at = NOW(), phone = NULL, email = NULL WHERE id = $1", [userId]);
  await query("UPDATE audit_logs SET actor_name = $1 WHERE actor_id = $2", [anonymizeAuditActor("deleted-user"), userId]);
}
