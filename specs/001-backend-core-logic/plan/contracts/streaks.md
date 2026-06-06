# API Contract: Streaks

## Get Current Streak

**Endpoint**: `GET /streaks/current`

**Authentication**: Required (`Bearer <jwt>`)

**Description**: Returns the user's current streak and longest streak, calculated dynamically from PrayerLog records.

### Request

No request body.

### Response (200 OK)

```json
{
  "current": 5,
  "longest": 12,
  "startDate": "2026-06-01",
  "endDate": "2026-06-05"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `current` | integer | Number of consecutive complete days up to the most recent complete day. |
| `longest` | integer | Maximum streak length ever achieved (derived dynamically for V1). |
| `startDate` | ISO date | First day of the current streak run. |
| `endDate` | ISO date | Most recent complete day in the current streak run. |

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "message": "Unauthorized" }` | Missing or invalid JWT. |
| 500 | `{ "message": "Internal server error" }` | Unexpected server error. |
