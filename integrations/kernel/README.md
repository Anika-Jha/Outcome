# KERNEL browser evidence ingestion

Have the KERNEL browser agent inspect the submitted public website and post its structured report to:

`POST {{outcome_api}}/api/integrations/kernel`

Headers:

- `Content-Type: application/json`
- `Authorization: Bearer {{kernel_webhook_secret}}`

Body example:

```json
{
  "outcomeId": "OUT-12345678",
  "url": "https://example.com",
  "summary": "Landing page checks completed",
  "sessionId": "kernel-session-id",
  "checks": [
    { "name": "Homepage loads", "status": "PASS", "details": "HTTP 200" },
    { "name": "Pricing section", "status": "PASS", "details": "Pricing heading detected" },
    { "name": "Contact form", "status": "FAIL", "details": "Submit button not found" }
  ]
}
```

The endpoint records the agent's report as `KERNEL_BROWSER_REPORT` evidence. The app does not claim to create or control a KERNEL session by itself; the browser agent/runner must be configured separately. Set `KERNEL_WEBHOOK_SECRET` on the server and in the KERNEL agent's tool configuration.
