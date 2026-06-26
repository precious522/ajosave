import { query } from "@/lib/db";
import type { CircleMessage } from "@/types";

export interface GetMessagesOptions {
  limit?: number;  // 1–100, default 50
  before?: string; // ISO 8601 timestamp cursor
}

export async function postMessage(
  circleId: string,
  userId: string,
  content: string
): Promise<CircleMessage> {
  const insertResult = await query<{ id: string }>(
    `INSERT INTO circle_messages (id, circle_id, user_id, content, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     RETURNING id`,
    [circleId, userId, content]
  );

  const messageId = insertResult.rows[0].id;

  const { rows } = await query<CircleMessage>(
    `SELECT
       cm.id,
       cm.circle_id   AS "circleId",
       cm.user_id     AS "userId",
       u.display_name AS "displayName",
       cm.content,
       cm.created_at  AS "createdAt"
     FROM circle_messages cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.id = $1`,
    [messageId]
  );

  return rows[0];
}

export async function getMessages(
  circleId: string,
  options?: GetMessagesOptions
): Promise<CircleMessage[]> {
  const rawLimit = options?.limit ?? 50;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const before = options?.before ?? null;

  const { rows } = await query<CircleMessage>(
    `SELECT
       cm.id,
       cm.circle_id   AS "circleId",
       cm.user_id     AS "userId",
       u.display_name AS "displayName",
       cm.content,
       cm.created_at  AS "createdAt"
     FROM circle_messages cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.circle_id = $1
       AND ($2::timestamp IS NULL OR cm.created_at < $2::timestamp)
     ORDER BY cm.created_at ASC
     LIMIT $3`,
    [circleId, before, limit]
  );

  return rows;
}
