import { query } from "@/lib/db";

export interface DailyAnalyticsRow {
  date: string;
  total_saved: string;
  active_circles: number;
  completion_rate: number;
  default_rate: number;
  created_at?: Date;
}

export interface CircleAnalytics {
  circleId: string;
  circleName: string;
  creatorId: string;
  status: string;
  totalContributionsCount: number;
  confirmedContributionsCount: number;
  missedContributionsCount: number;
  totalSaved: string;
  completionRate: number;
  defaultRate: number;
  activeMembersCount: number;
  defaultedMembersCount: number;
}

/**
 * Aggregate and save analytics data for today.
 */
export async function aggregateDailyAnalytics(): Promise<void> {
  // First ensure historical data is backfilled so we don't have gaps.
  await backfillHistoricalDailyAnalytics();

  // 1. Calculate total saved (sum of confirmed contributions in USDC)
  const savedRes = await query<{ total: string }>(
    "SELECT COALESCE(SUM(amount_usdc), 0)::text as total FROM contributions WHERE status = 'confirmed'"
  );
  const totalSaved = savedRes.rows[0]?.total || "0";

  // 2. Calculate active circles count
  const circlesRes = await query<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM circles WHERE status = 'active' AND deleted_at IS NULL"
  );
  const activeCircles = circlesRes.rows[0]?.count || 0;

  // 3. Calculate circle completion rate (completed / (completed + cancelled))
  const compRateRes = await query<{ rate: string }>(
    `SELECT
       COALESCE(
         (COUNT(*) FILTER (WHERE status = 'completed'))::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled')), 0) * 100,
         100.00
       )::text as rate
     FROM circles
     WHERE deleted_at IS NULL`
  );
  const completionRate = parseFloat(compRateRes.rows[0]?.rate || "100.00");

  // 4. Calculate contribution default rate (missed / (confirmed + missed))
  const defRateRes = await query<{ rate: string }>(
    `SELECT
       COALESCE(
         (COUNT(*) FILTER (WHERE status = 'missed'))::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('confirmed', 'missed')), 0) * 100,
         0.00
       )::text as rate
     FROM contributions`
  );
  const defaultRate = parseFloat(defRateRes.rows[0]?.rate || "0.00");

  // 5. Insert or update today's analytics row
  await query(
    `INSERT INTO daily_analytics (date, total_saved, active_circles, completion_rate, default_rate)
     VALUES (CURRENT_DATE, $1, $2, $3, $4)
     ON CONFLICT (date) DO UPDATE
     SET total_saved = EXCLUDED.total_saved,
         active_circles = EXCLUDED.active_circles,
         completion_rate = EXCLUDED.completion_rate,
         default_rate = EXCLUDED.default_rate`,
    [totalSaved, activeCircles, completionRate, defaultRate]
  );
}

/**
 * Backfill historical daily analytics since the first circle was created.
 */
export async function backfillHistoricalDailyAnalytics(): Promise<void> {
  const countRes = await query("SELECT COUNT(*) FROM daily_analytics");
  const count = parseInt(countRes.rows[0]?.count || "0", 10);
  if (count > 0) return; // Already has aggregated data

  const firstCircleRes = await query("SELECT MIN(created_at) as date FROM circles");
  const firstDateStr = firstCircleRes.rows[0]?.date;
  if (!firstDateStr) return; // No circles to backfill for

  const firstDate = new Date(firstDateStr);
  const today = new Date();
  
  const currentDate = new Date(firstDate);
  currentDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  while (currentDate < today) {
    const dateStr = currentDate.toISOString().split("T")[0];

    // Compute stats up to dateStr
    const savedRes = await query<{ total: string }>(
      "SELECT COALESCE(SUM(amount_usdc), 0)::text as total FROM contributions WHERE status = 'confirmed' AND created_at <= $1",
      [currentDate]
    );
    const totalSaved = savedRes.rows[0]?.total || "0";

    const circlesRes = await query<{ count: number }>(
      "SELECT COUNT(*)::int as count FROM circles WHERE status = 'active' AND created_at <= $1 AND (deleted_at IS NULL OR deleted_at > $1)",
      [currentDate]
    );
    const activeCircles = circlesRes.rows[0]?.count || 0;

    const compRateRes = await query<{ rate: string }>(
      `SELECT
         COALESCE(
           (COUNT(*) FILTER (WHERE status = 'completed'))::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled')), 0) * 100,
           100.00
         )::text as rate
       FROM circles
       WHERE created_at <= $1 AND (deleted_at IS NULL OR deleted_at > $1)`,
       [currentDate]
    );
    const completionRate = parseFloat(compRateRes.rows[0]?.rate || "100.00");

    const defRateRes = await query<{ rate: string }>(
      `SELECT
         COALESCE(
           (COUNT(*) FILTER (WHERE status = 'missed'))::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('confirmed', 'missed')), 0) * 100,
           0.00
         )::text as rate
       FROM contributions
       WHERE created_at <= $1`,
       [currentDate]
    );
    const defaultRate = parseFloat(defRateRes.rows[0]?.rate || "0.00");

    await query(
      `INSERT INTO daily_analytics (date, total_saved, active_circles, completion_rate, default_rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date) DO NOTHING`,
      [dateStr, totalSaved, activeCircles, completionRate, defaultRate]
    );

    currentDate.setDate(currentDate.getDate() + 1);
  }
}

/**
 * Fetch daily aggregated analytics for charts (time series).
 */
export async function getDailyAnalytics(): Promise<DailyAnalyticsRow[]> {
  await backfillHistoricalDailyAnalytics();
  
  // Calculate today's on-the-fly and combine to make sure we always include today.
  // First, get historical rows from DB
  const { rows } = await query<DailyAnalyticsRow>(
    "SELECT date::text, total_saved, active_circles, completion_rate, default_rate FROM daily_analytics ORDER BY date ASC"
  );
  
  // Get today's values on-the-fly to return real-time info
  const savedRes = await query<{ total: string }>(
    "SELECT COALESCE(SUM(amount_usdc), 0)::text as total FROM contributions WHERE status = 'confirmed'"
  );
  const totalSaved = savedRes.rows[0]?.total || "0";

  const circlesRes = await query<{ count: number }>(
    "SELECT COUNT(*)::int as count FROM circles WHERE status = 'active' AND deleted_at IS NULL"
  );
  const activeCircles = circlesRes.rows[0]?.count || 0;

  const compRateRes = await query<{ rate: string }>(
    `SELECT
       COALESCE(
         (COUNT(*) FILTER (WHERE status = 'completed'))::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'cancelled')), 0) * 100,
         100.00
       )::text as rate
     FROM circles
     WHERE deleted_at IS NULL`
  );
  const completionRate = parseFloat(compRateRes.rows[0]?.rate || "100.00");

  const defRateRes = await query<{ rate: string }>(
    `SELECT
       COALESCE(
         (COUNT(*) FILTER (WHERE status = 'missed'))::numeric / NULLIF(COUNT(*) FILTER (WHERE status IN ('confirmed', 'missed')), 0) * 100,
         0.00
       )::text as rate
     FROM contributions`
  );
  const defaultRate = parseFloat(defRateRes.rows[0]?.rate || "0.00");

  const todayStr = new Date().toISOString().split("T")[0];
  
  // Check if today already exists in the rows. If so, update it, else append.
  const todayIndex = rows.findIndex(r => r.date === todayStr);
  const todayRow: DailyAnalyticsRow = {
    date: todayStr,
    total_saved: totalSaved,
    active_circles: activeCircles,
    completion_rate: completionRate,
    default_rate: defaultRate
  };

  if (todayIndex >= 0) {
    rows[todayIndex] = todayRow;
  } else {
    rows.push(todayRow);
  }

  return rows;
}

/**
 * Fetch per-circle analytics for admins.
 */
export async function adminGetPerCircleAnalytics(): Promise<CircleAnalytics[]> {
  const { rows } = await query<CircleAnalytics>(
    `WITH contrib_stats AS (
       SELECT
         circle_id,
         COUNT(id) AS total_count,
         COUNT(id) FILTER (WHERE status = 'confirmed') AS confirmed_count,
         COUNT(id) FILTER (WHERE status = 'missed') AS missed_count,
         SUM(amount_usdc) FILTER (WHERE status = 'confirmed') AS total_saved
       FROM contributions
       GROUP BY circle_id
     ),
     member_stats AS (
       SELECT
         circle_id,
         COUNT(id) FILTER (WHERE status = 'active') AS active_count,
         COUNT(id) FILTER (WHERE status = 'defaulted') AS defaulted_count
       FROM members
       GROUP BY circle_id
     )
     SELECT
       c.id AS "circleId",
       c.name AS "circleName",
       c.creator_id AS "creatorId",
       c.status AS "status",
       COALESCE(cs.total_count, 0)::int AS "totalContributionsCount",
       COALESCE(cs.confirmed_count, 0)::int AS "confirmedContributionsCount",
       COALESCE(cs.missed_count, 0)::int AS "missedContributionsCount",
       COALESCE(cs.total_saved, 0)::text AS "totalSaved",
       ROUND(
         COALESCE(
           (cs.confirmed_count)::numeric / NULLIF(cs.confirmed_count + cs.missed_count, 0) * 100,
           100.00
         ), 2
       )::float AS "completionRate",
       ROUND(
         COALESCE(
           (cs.missed_count)::numeric / NULLIF(cs.confirmed_count + cs.missed_count, 0) * 100,
           0.00
         ), 2
       )::float AS "defaultRate",
       COALESCE(ms.active_count, 0)::int AS "activeMembersCount",
       COALESCE(ms.defaulted_count, 0)::int AS "defaultedMembersCount"
     FROM circles c
     LEFT JOIN contrib_stats cs ON cs.circle_id = c.id
     LEFT JOIN member_stats ms ON ms.circle_id = c.id
     WHERE c.deleted_at IS NULL
     ORDER BY c.created_at DESC`
  );
  return rows;
}
