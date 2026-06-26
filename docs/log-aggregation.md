# Log Aggregation with Datadog

Ajosave ships structured JSON logs from pino to Datadog in production via `pino-datadog-transport`.

---

## Enabling Datadog log aggregation

1. **Install the transport package**

   ```bash
   npm install pino-datadog-transport
   ```

2. **Set environment variables**

   ```
   DATADOG_API_KEY=<your-datadog-api-key>
   LOG_AGGREGATION_SERVICE=datadog
   ```

   When `DATADOG_API_KEY` is set in production, all pino log records are shipped directly to the Datadog Logs intake. If the package is missing the app falls back silently to stdout JSON.

3. **Verify** — run in staging and check the [Datadog Log Explorer](https://app.datadoghq.com/logs) for entries with `service:ajosave`.

---

## 30-day log retention policy

1. Open **Datadog → Logs → Configuration → Indexes**.
2. Click the `main` index (or create a dedicated `ajosave` index with filter `service:ajosave`).
3. Set **Retention** to **30 days** and save.

> Logs older than 30 days are purged automatically; no manual action needed after this is set.

---

## Alert: error rate spike

Create a monitor that fires when the error log rate rises above a threshold:

1. Go to **Monitors → New Monitor → Log Monitor**.
2. **Query**: `service:ajosave @level:error`
3. **Evaluate the query over the last**: `5 minutes`, rolling.
4. **Alert condition**: `count > 10` in 5 minutes (tune to your baseline).
5. **Notification message**:

   ```
   🚨 Ajosave error spike: {{value}} errors in the last 5 minutes.
   [View logs](https://app.datadoghq.com/logs?query=service%3Aajosave%20%40level%3Aerror)
   ```

6. Add your Slack channel or PagerDuty integration under **Notify your team**.
7. Save as **Ajosave — Error Rate Spike**.

---

## Key metrics dashboard

1. Go to **Dashboards → New Dashboard → New Timeboard**, name it **Ajosave – Application Health**.
2. Add the following widgets:

| Widget | Query | Viz |
|--------|-------|-----|
| Error rate | `logs("service:ajosave @level:error").rollup("count", 60)` | Timeseries |
| Warn rate | `logs("service:ajosave @level:warn").rollup("count", 60)` | Timeseries |
| Total log volume | `logs("service:ajosave").rollup("count", 300)` | Timeseries |
| Top error messages | `service:ajosave @level:error` | Top List (field: `message`) |
| P95 response time | `avg:trace.express.request.duration{service:ajosave}` | Timeseries |

3. Set the default time window to **Last 24 hours** and save.

---

## Vercel log drain (alternative / complementary)

Vercel also supports forwarding logs to Datadog via a log drain without any SDK changes:

1. **Vercel Dashboard → Project → Settings → Log Drains → Add Log Drain**.
2. Choose **Datadog**, paste your API key, select **Source: Lambda** and **Build**.
3. Save — Vercel will POST all invocation logs to Datadog automatically.

Use both together: the pino transport captures structured app-level logs; the Vercel drain captures infrastructure/build logs.
