import { NextRequest, NextResponse } from "next/server";
import { adminGetPerCircleAnalytics } from "@/server/services/analytics.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const data = await adminGetPerCircleAnalytics();

    const headers = [
      "Circle ID",
      "Circle Name",
      "Creator ID",
      "Status",
      "Total Contributions Count",
      "Confirmed Contributions Count",
      "Missed Contributions Count",
      "Total Saved (USDC)",
      "Completion Rate (%)",
      "Default Rate (%)",
      "Active Members Count",
      "Defaulted Members Count"
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        [
          row.circleId,
          row.circleName,
          row.creatorId,
          row.status,
          row.totalContributionsCount,
          row.confirmedContributionsCount,
          row.missedContributionsCount,
          row.totalSaved,
          row.completionRate,
          row.defaultRate,
          row.activeMembersCount,
          row.defaultedMembersCount
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="circle_performance_analytics_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  })
);
