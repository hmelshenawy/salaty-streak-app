# API Contract: Awards

## Get Awards

**Endpoint**: `GET /awards`

**Authentication**: Required (`Bearer <jwt>`)

**Description**: Returns all awards with earned/locked status and progress toward the next milestone.

### Request

No request body.

### Response (200 OK)

```json
{
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
  "nextTarget": {
    "awardType": "STREAK",
    "milestone": 15,
    "daysRemaining": 10
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `earned` | array | Awards that have been granted. Each has `id`, `awardType`, `milestone`, `grantedAt`. |
| `locked` | array | Awards not yet earned. Each has `awardType`, `milestone`, `progress` (current streak), `target` (milestone value). |
| `nextTarget` | object | The nearest locked award. `daysRemaining` = `target - progress`. |

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 401 | `{ "message": "Unauthorized" }` | Missing or invalid JWT. |
| 500 | `{ "message": "Internal server error" }` | Unexpected server error. |
