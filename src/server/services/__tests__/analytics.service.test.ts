import {
  aggregateDailyAnalytics,
  backfillHistoricalDailyAnalytics,
  getDailyAnalytics,
  adminGetPerCircleAnalytics
} from "@/server/services/analytics.service";
import * as db from "@/lib/db";

jest.mock("@/lib/db");

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("analytics.service", () => {
  describe("aggregateDailyAnalytics", () => {
    it("should aggregate data and insert into daily_analytics", async () => {
      // 1. mock count in backfill check
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "1" }] } as any); // backfill count check
      // 2. mock total saved query
      mockQuery.mockResolvedValueOnce({ rows: [{ total: "1000.5000000" }] } as any);
      // 3. mock active circles query
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] } as any);
      // 4. mock completion rate query
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: "95.50" }] } as any);
      // 5. mock default rate query
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: "2.10" }] } as any);
      // 6. mock upsert query
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await aggregateDailyAnalytics();

      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining("INSERT INTO daily_analytics"),
        ["1000.5000000", 5, 95.5, 2.1]
      );
    });
  });

  describe("getDailyAnalytics", () => {
    it("should return time series analytics including today", async () => {
      // 1. backfill check (has data)
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "1" }] } as any);
      // 2. historical rows fetch
      const mockHistorical = [
        { date: "2026-05-27", total_saved: "900.00", active_circles: 4, completion_rate: 100, default_rate: 0 }
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockHistorical } as any);
      // 3. today's on-the-fly total saved
      mockQuery.mockResolvedValueOnce({ rows: [{ total: "1050.00" }] } as any);
      // 4. today's active circles
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 6 }] } as any);
      // 5. today's completion rate
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: "98.00" }] } as any);
      // 6. today's default rate
      mockQuery.mockResolvedValueOnce({ rows: [{ rate: "1.50" }] } as any);

      const result = await getDailyAnalytics();

      expect(result.length).toBe(2);
      expect(result[0].date).toBe("2026-05-27");
      expect(result[1].total_saved).toBe("1050.00");
      expect(result[1].active_circles).toBe(6);
    });
  });

  describe("adminGetPerCircleAnalytics", () => {
    it("should query per-circle analytics correctly", async () => {
      const mockCirclesStats = [
        {
          circleId: "c-1",
          circleName: "Main Circle",
          creatorId: "u-1",
          status: "active",
          totalContributionsCount: 10,
          confirmedContributionsCount: 9,
          missedContributionsCount: 1,
          totalSaved: "90.00",
          completionRate: 90,
          defaultRate: 10,
          activeMembersCount: 5,
          defaultedMembersCount: 1
        }
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockCirclesStats } as any);

      const result = await adminGetPerCircleAnalytics();

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WITH contrib_stats AS"));
      expect(result).toEqual(mockCirclesStats);
    });
  });
});
