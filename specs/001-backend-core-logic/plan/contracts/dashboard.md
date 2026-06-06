# API Contract: Dashboard

**Endpoint**: `GET /dashboard`

**Authentication**: Required (`Bearer <jwt>`)

**Description**: Returns all data needed by the frontend home screen in a single response.

## Request

No request body.

## Response (200 OK)

```json
{
  "today": {
    "date": "2026-06-05",
    "prayers": [
      {
        "type": "FAJR",
        "status": "COMPLETED",
        "completedAt": "2026-06-05T05:30:00.000Z"
      },
      {
        "type": "DHUHR",
        "status": "COMPLETED",
        "completedAt": "2026-06-05T12:15:00.000Z"
      },
      {
        "type": "ASR",
        "status": "PENDING"
      },
      {
        "type": "MAGHRIB",
        "status": "PENDING"
      },
      {
        "type": "ISHA",
        "status": "PENDING"
      }
    ],
    "isComplete": false,
    "prayersCompleted": 2,
    "prayersRemaining": 3
  },
  "streak": {
    "current": 5,
    "longest": 12,
    "lastCompletedDate": "2026-06-05"
  },
  "points": {
    "total": 85,
    "breakdown": {
      "dailyCompletion": 60,
      "streakBonus": 25
    }
  },
  "awards": {
    "earned": [
      {
        "id": "award-uuid-1",
        "awardType": "STREAK",
        "milestone": 7,
        "grantedAt": "2026-06-01T00:00:00.000Z"
      }
    ],
    "locked": [
      {
        "awardType": "STREAK",
        "milestone": 15,
        "progress": 5,
        "target": 15
      },
      {
        "awardType": "STREAK",
        "milestone": 30,
        "progress": 5,
        "target": 30
      }
    ],
    "nextAwardTarget": {
      "awardType": "STREAK",
      "milestone": 15,
      "prayersRemaining": 10
    }
  },
  "timezone": {
    "value": "Africa/Cairo",
    "isDefaulted": false
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `today.date` | ISO date | Today's date in the user's local timezone. |
| `today.prayers` | array | 5 prayer entries. Each has `type`, `status` (COMPLETED/PENDING), and optional `completedAt`. |
| `today.isComplete` | boolean | True if all 5 prayers are COMPLETED for today. |
| `today.prayersCompleted` | integer | Count of completed prayers today. |
| `today.prayersRemaining` | integer | Count of pending prayers today. |
| `streak.current` | integer | Consecutive complete days including today if complete. |
| `streak.longest` | integer | Maximum streak ever achieved. |
| `streak.lastCompletedDate` | ISO date | Most recent fully complete day. |
| `points.total` | integer | Sum of all PointTransaction points. |
| `points.breakdown.dailyCompletion` | integer | Points from base daily completions. |
| `points.breakdown.streakBonus` | integer | Points from streak bonuses. |
| `awards.earned` | array | Granted awards with `id`, `awardType`, `milestone`, `grantedAt`. |
| `awards.locked` | array | Not-yet-earned awards with `awardType`, `milestone`, `progress`, `target`. |
| `awards.nextAwardTarget` | object | The nearest locked award with `awardType`, `milestone`, and `prayersRemaining` (days needed). |
| `timezone.value` | string | User's IANA timezone. |
| `timezone.isDefaulted` | boolean | True if the backend fell back to UTC. |

## Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "message": "Unauthorized" }` | Missing or invalid JWT. |
| 500 | `{ "message": "Internal server error" }` | Unexpected server error. |
