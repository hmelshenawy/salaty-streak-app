# API Contract: Prayers

## Mark Prayer as Completed

**Endpoint**: `POST /prayers/:prayerType/complete`

**Authentication**: Required (`Bearer <jwt>`)

**Description**: Marks a specific prayer as completed for today. Idempotent. Triggers backend orchestration (daily completeness, streak recalculation, points, awards).

### Request

**Path Parameters**:

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `prayerType` | string | Must be one of: `fajr`, `dhuhr`, `asr`, `maghrib`, `isha` (case-insensitive, normalized to uppercase). |

**Request Body**: None.

### Response (200 OK)

Returns the updated dashboard state (same shape as `GET /api/dashboard`).

```json
{
  "today": { ... },
  "streak": { ... },
  "points": { ... },
  "awards": { ... },
  "timezone": { ... }
}
```

### Response (201 Created)

Returned on the first creation of a prayer log for the day. Body is identical to 200.

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "message": "Invalid prayer type", "error": "Bad Request" }` | `prayerType` is not one of the allowed values. |
| 401 | `{ "message": "Unauthorized" }` | Missing or invalid JWT. |
| 403 | `{ "message": "Edit window expired" }` | The prayer date is outside today + previous 3 days. |
| 500 | `{ "message": "Internal server error" }` | Unexpected server error. |

---

## Unmark Prayer

**Endpoint**: `POST /prayers/:prayerType/uncomplete`

**Authentication**: Required (`Bearer <jwt>`)

**Description**: Removes the completion mark for a specific prayer. Triggers backend orchestration (daily completeness, streak recalculation, points adjustment, awards unchanged).

### Request

**Path Parameters**:

| Parameter | Type | Constraints |
|-----------|------|-------------|
| `prayerType` | string | Must be one of: `fajr`, `dhuhr`, `asr`, `maghrib`, `isha` (case-insensitive, normalized to uppercase). |

**Request Body**: None.

### Response (200 OK)

Returns the updated dashboard state (same shape as `GET /api/dashboard`).

```json
{
  "today": { ... },
  "streak": { ... },
  "points": { ... },
  "awards": { ... },
  "timezone": { ... }
}
```

### Error Responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "message": "Invalid prayer type", "error": "Bad Request" }` | `prayerType` is not one of the allowed values. |
| 401 | `{ "message": "Unauthorized" }` | Missing or invalid JWT. |
| 403 | `{ "message": "Edit window expired" }` | The prayer date is outside today + previous 3 days. |
| 404 | `{ "message": "Prayer log not found" }` | The prayer has not been marked complete for this date; nothing to uncomplete. |
| 500 | `{ "message": "Internal server error" }` | Unexpected server error. |
