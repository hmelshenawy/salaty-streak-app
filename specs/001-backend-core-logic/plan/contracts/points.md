# API Contract: Points

## Get Points Summary

**Endpoint**: `GET /points/summary`

**Authentication**: Required (`Bearer <jwt>`)

**Description**: Returns the user's total points, a breakdown by reason, and recent transactions.

### Request

No request body.

### Response (200 OK)

```json
{
  "total": 85,
  "breakdown": {
    "dailyCompletion": 60,
    "streakBonus": 25,
    "adjustment": 0
  },
  "recentTransactions": [
    {
      "id": "txn-uuid-1",
      "points": 15,
      "reason": "DAILY_COMPLETION",
      "relatedDate": "2026-06-05",
      "createdAt": "2026-06-05T22:00:00.000Z"
    },
    {
      "id": "txn-uuid-2",
      "points": 5,
      "reason": "STREAK_BONUS",
      "relatedDate": "2026-06-05",
      "createdAt": "2026-06-05T22:00:00.000Z"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `total` | integer | Sum of all PointTransaction points for the user. |
| `breakdown.dailyCompletion` | integer | Points from `reason = DAILY_COMPLETION`. |
| `breakdown.streakBonus` | integer | Points from `reason = STREAK_BONUS`. |
| `breakdown.adjustment` | integer | Points from `reason = ADJUSTMENT` (admin-level corrections only; no automatic reversals on uncompletion per FR-022). |
| `recentTransactions` | array | Last 10 transactions (most recent first). Each has `id`, `points`, `reason`, `relatedDate`, `createdAt`. |

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "message": "Unauthorized" }` | Missing or invalid JWT. |
| 500 | `{ "message": "Internal server error" }` | Unexpected server error. |
