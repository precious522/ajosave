import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// Custom metrics
const payoutDuration = new Trend("payout_duration", true);
const payoutErrorRate = new Rate("payout_error_rate");

export const options = {
  // 50 concurrent virtual users
  vus: 50,
  duration: "30s",
  thresholds: {
    // p95 latency baseline: document actual value from first run
    http_req_duration: ["p(95)<5000"],
    payout_error_rate: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const CRON_SECRET = __ENV.CRON_SECRET || "test-secret";
// Circle ID to use for load testing (set via env or use a test fixture)
const CIRCLE_ID = __ENV.CIRCLE_ID || "test-circle-id";

export default function () {
  const res = http.post(
    `${BASE_URL}/api/cron/cycle`,
    JSON.stringify({ circleId: CIRCLE_ID }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      timeout: "10s",
    }
  );

  payoutDuration.add(res.timings.duration);
  payoutErrorRate.add(res.status >= 500);

  check(res, {
    "status is not 5xx": (r) => r.status < 500,
    "response has body": (r) => r.body && r.body.length > 0,
  });

  sleep(0.5);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"];
  console.log(`\n=== Payout Endpoint Load Test Results ===`);
  console.log(`p95 latency: ${p95 ? p95.toFixed(2) + "ms" : "N/A"}`);
  console.log(
    `Error rate: ${(data.metrics.payout_error_rate?.values?.rate * 100 || 0).toFixed(2)}%`
  );
  console.log(`Total requests: ${data.metrics.http_reqs?.values?.count || 0}`);

  return {
    "k6-results/summary.json": JSON.stringify(data, null, 2),
    stdout: "\n",
  };
}
