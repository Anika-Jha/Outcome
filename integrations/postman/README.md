# Postman evidence ingestion

After a Postman collection run, publish the relevant run summary to:

`POST {{outcome_api}}/api/integrations/postman`

Headers:

- `Content-Type: application/json`
- `Authorization: Bearer {{postman_webhook_secret}}`

Body example:

```json
{
  "outcomeId": "OUT-12345678",
  "run": {
    "stats": {
      "assertions": { "passed": 24, "failed": 0 }
    },
    "collection": { "name": "Outcome API acceptance tests" }
  }
}
```

The endpoint stores the test run as `POSTMAN_TEST_RUN` evidence. It does not itself execute a Postman collection; configure your Postman runner/monitor or a small post-run script to send the summary. Set `POSTMAN_WEBHOOK_SECRET` on the server and in the Postman environment.
