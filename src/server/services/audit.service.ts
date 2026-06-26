import { query } from "@/lib/db";

export type AuditAction = "TRIGGER_PAYOUT" | "REMOVE_MEMBER" | "DELETE_USER" | "DELETE_CIRCLE" | "UPDATE_CIRCLE" | "OTHER";
export type AuditTargetType = "CIRCLE" | "MEMBER" | "USER" | "PAYOUT" | "OTHER";

export interface AuditLog {
  id: string;
  actor_id: string;
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface AuditLogResponse {
  id: string;
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Logs an admin action to the audit trail.
 * Audit logs are append-only and immutable.
 */
export async function logAuditAction(
  actorId: string,
  action: AuditAction,
  targetType: AuditTargetType,
  targetId: string,
  options?: {
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<AuditLog> {
  const { rows } = await query<AuditLog>(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, actor_id, action, target_type, target_id, details, ip_address, user_agent, created_at`,
    [
      actorId,
      action,
      targetType,
      targetId,
      options?.details ? JSON.stringify(options.details) : null,
      options?.ipAddress || null,
      options?.userAgent || null,
    ]
  );

  return rows[0];
}

/**
 * Retrieves audit logs with optional filtering.
 */
export async function getAuditLogs(options?: {
  actorId?: string;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<AuditLogResponse[]> {
  let whereConditions: string[] = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (options?.actorId) {
    whereConditions.push(`actor_id = $${paramIndex++}`);
    params.push(options.actorId);
  }

  if (options?.action) {
    whereConditions.push(`action = $${paramIndex++}`);
    params.push(options.action);
  }

  if (options?.targetType) {
    whereConditions.push(`target_type = $${paramIndex++}`);
    params.push(options.targetType);
  }

  if (options?.targetId) {
    whereConditions.push(`target_id = $${paramIndex++}`);
    params.push(options.targetId);
  }

  if (options?.startDate) {
    whereConditions.push(`created_at >= $${paramIndex++}`);
    params.push(options.startDate);
  }

  if (options?.endDate) {
    whereConditions.push(`created_at <= $${paramIndex++}`);
    params.push(options.endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  whereConditions.push(`LIMIT $${paramIndex++}`);
  params.push(limit);

  whereConditions.push(`OFFSET $${paramIndex++}`);
  params.push(offset);

  const { rows } = await query<AuditLog>(
    `SELECT id, actor_id, action, target_type, target_id, details, ip_address, user_agent, created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex - 1}
     OFFSET $${paramIndex}`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

/**
 * Gets audit logs for a specific actor (admin user).
 */
export async function getAuditLogsByActor(
  actorId: string,
  limit = 100,
  offset = 0
): Promise<AuditLogResponse[]> {
  return getAuditLogs({ actorId, limit, offset });
}

/**
 * Gets audit logs for a specific target (circle, member, etc).
 */
export async function getAuditLogsByTarget(
  targetType: AuditTargetType,
  targetId: string,
  limit = 100,
  offset = 0
): Promise<AuditLogResponse[]> {
  return getAuditLogs({ targetType, targetId, limit, offset });
}

/**
 * Gets audit logs for a specific action type.
 */
export async function getAuditLogsByAction(
  action: AuditAction,
  limit = 100,
  offset = 0
): Promise<AuditLogResponse[]> {
  return getAuditLogs({ action, limit, offset });
}

/**
 * Gets total count of audit logs (for pagination).
 */
export async function getAuditLogCount(options?: {
  actorId?: string;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<number> {
  let whereConditions: string[] = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (options?.actorId) {
    whereConditions.push(`actor_id = $${paramIndex++}`);
    params.push(options.actorId);
  }

  if (options?.action) {
    whereConditions.push(`action = $${paramIndex++}`);
    params.push(options.action);
  }

  if (options?.targetType) {
    whereConditions.push(`target_type = $${paramIndex++}`);
    params.push(options.targetType);
  }

  if (options?.targetId) {
    whereConditions.push(`target_id = $${paramIndex++}`);
    params.push(options.targetId);
  }

  if (options?.startDate) {
    whereConditions.push(`created_at >= $${paramIndex++}`);
    params.push(options.startDate);
  }

  if (options?.endDate) {
    whereConditions.push(`created_at <= $${paramIndex++}`);
    params.push(options.endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const { rows } = await query<{ count: number }>(
    `SELECT COUNT(*)::int as count FROM audit_logs ${whereClause}`,
    params
  );

  return rows[0]?.count || 0;
}
