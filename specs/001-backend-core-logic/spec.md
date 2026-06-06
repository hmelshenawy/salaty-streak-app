# Feature Specification: Move Core Logic to Backend

**Feature Branch**: `001-backend-core-logic`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "Move Salaty Streak core app logic to the backend. The backend must be the single source of truth for prayer completion, daily completion, points, streak calculation, missed day handling, timezone/day boundary, and awards. Frontend should only display data, collect user actions, and call backend APIs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mark Prayer Completed (Priority: P1) 🎯 MVP

A user opens the app after Fajr and marks Fajr as completed. The backend validates the request, upserts the prayer log, derives whether the day is fully complete, recalculates the current streak dynamically from PrayerLog records, writes a points transaction if the day became complete, checks for newly eligible awards, and returns the updated dashboard state. The frontend simply renders the response.

**Why this priority**: Prayer marking is the single most frequent user action and the core value proposition of the app. Without it, nothing else matters.

**Independent Test**: A user can mark any of the five daily prayers as completed. The backend persists the record (idempotently) and returns the updated dashboard state. The frontend displays the prayer as completed. This delivers value without requiring streaks, points, or awards to be visible.

**Acceptance Scenarios**:

1. **Given** a user has not yet marked Fajr today, **When** the user marks Fajr as completed, **Then** the backend upserts a prayer log with prayerType=FAJR, status=COMPLETED, and timestamp, derives that the day is not yet fully complete (4 prayers remaining), and returns the updated dashboard state with Fajr marked complete and streak unchanged.
2. **Given** a user has completed 4 prayers today and now marks the 5th, **When** the user marks the final prayer as completed, **Then** the backend derives the day as fully complete, writes a PointTransaction for that day, recalculates the streak dynamically from PrayerLog records, checks for awards, and returns the updated dashboard with the new streak, points, and any newly granted awards.
3. **Given** a user has already marked Fajr as completed, **When** the user attempts to mark Fajr as completed again, **Then** the backend performs an idempotent upsert (no duplicate record created) and returns the existing state.
4. **Given** an unauthenticated request, **When** any prayer marking API is called, **Then** the backend returns HTTP 401 Unauthorized.

---

### User Story 2 - View Dashboard (Priority: P1) 🎯 MVP

A user opens the app at any time to see their home screen. The backend computes and returns all dashboard data in a single response: today's prayer status, current streak, longest streak, total points, earned awards, locked awards, next award target, and timezone information. The frontend renders it without any calculation.

**Why this priority**: The dashboard is the first screen every user sees. A single API call reduces latency and simplifies frontend state management.

**Independent Test**: A user can open the app and see the complete home screen populated from one backend call. This works independently of any other feature.

**Acceptance Scenarios**:

1. **Given** a user has completed Fajr and Dhuhr with a 5-day streak, **When** the user requests the dashboard, **Then** the backend returns today's status (Fajr and Dhuhr completed, Asr/Maghrib/Isha pending), streak=5, longestStreak=<max ever derived from PrayerLogs>, totalPoints=<sum of PointTransactions>, earned awards, locked awards with progress, next award target, and timezone info.
2. **Given** a user in a different timezone (e.g., UTC+3 vs UTC-5), **When** the user requests the dashboard just after local midnight, **Then** the backend correctly determines "today" using the user's configured IANA timezone.
3. **Given** a user has not configured a timezone, **When** the user requests the dashboard, **Then** the backend falls back to UTC and includes `timezoneDefaulted: true` in the response.

---

### User Story 3 - Unmark Prayer & Recalculate (Priority: P2)

A user accidentally marked a prayer and wants to undo it. The backend removes the completion, derives that the day may no longer be fully complete, recalculates the streak dynamically (which may break if the day was part of the streak), and returns the updated dashboard. Awards already granted are NOT revoked. Points previously earned via PointTransaction are NOT reversed (see FR-022 Points Permanence).

**Why this priority**: Users make mistakes. Allowing uncompletion is essential for data accuracy and user trust.

**Independent Test**: A user can unmark a previously completed prayer. The backend updates the state and returns the correct new streak and points. This story depends on the existence of prayer logs (from US1) but is independently testable once logs exist.

**Acceptance Scenarios**:

1. **Given** a user has completed all 5 prayers today (day is fully complete), **When** the user unmarks Fajr, **Then** the backend updates the prayer log to UNCOMPLETED, derives the day as incomplete, recalculates streak dynamically to the last fully complete day, and returns the updated dashboard. Previously earned PointTransactions are NOT reversed or deleted (see FR-022 Points Permanence).
2. **Given** a user's streak broke yesterday and today is day 1 of a new streak, **When** the user unmarks a prayer from today, **Then** the backend derives today as incomplete and streak becomes 0.
3. **Given** a user tries to unmark a prayer from 5 days ago, **When** the uncompletion API is called, **Then** the backend returns HTTP 403 Forbidden because edits are restricted to today and the previous 3 days.

---

### User Story 4 - View Earned and Locked Awards (Priority: P2)

A user wants to see which milestone awards they have earned and which are still locked. The backend grants awards automatically when streak thresholds are crossed (7, 15, and 30 days) and returns the full list with earned/locked status and progress.

**Why this priority**: Awards enhance engagement, but the app works without them.

**Independent Test**: A user can view an awards screen showing earned awards and locked awards with progress. The backend determines eligibility using the `awardType` + `milestone` model.

**Acceptance Scenarios**:

1. **Given** a user has achieved a 7-day streak for the first time, **When** the backend processes the completion that triggered the 7th day, **Then** an award record with `awardType=STREAK` and `milestone=7` is granted, persisted, and returned as earned in subsequent requests.
2. **Given** a user has a 14-day streak, **When** the user requests the awards list, **Then** the 7-day award is shown as earned, and the 15-day and 30-day awards are shown as locked with progress=14/15 and progress=14/30.
3. **Given** a user's streak breaks from 8 to 0, **When** the user later rebuilds to 7 days, **Then** the 7-day award remains earned (awards are not revoked once granted).

### Edge Cases

- What happens when a user marks a prayer completed after their local midnight but before the next prayer time? The day boundary is based on local midnight, not prayer times.
- How does the system handle a user who completes prayers out of order (e.g., Dhuhr before Fajr)? The backend records the actual timestamp; daily completeness only checks that all five are marked complete by day end.
- What happens if the user travels and changes timezones mid-day? The backend uses the timezone configured at request time for the current day's boundary. Historical days remain locked to the timezone used when they were recorded.
- How does the system handle a day with no prayer logs? That day counts as missed for streak purposes.
- What happens if the backend receives two concurrent requests to mark the same prayer? The upsert operation plus the unique database constraint on `(userId, date, prayerType)` guarantee idempotency and prevent duplicates.
- What happens if a user unmarks a prayer that was part of a completed day and streak? The backend recalculates daily completeness for that day. If the day is no longer complete, the streak resets to the most recent consecutive complete day. Points are NOT reversed or deleted (FR-022 Points Permanence). Awards are NOT revoked.
- What happens if a user changes their timezone after recording prayers? Historical prayer logs keep their original local `date`. Only new logs and "today" calculations use the updated timezone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend MUST expose an authenticated API `GET /api/dashboard` that returns all data needed by the frontend home screen in a single response: today's prayer status, current streak, longest streak, total points, earned awards, locked awards, next award target, and timezone information.
- **FR-002**: The backend MUST expose an authenticated API `POST /api/prayers/:prayerType/complete` that marks a specific prayer as completed for today. PrayerType MUST be one of: Fajr, Dhuhr, Asr, Maghrib, Isha.
- **FR-003**: The backend MUST expose an authenticated API `POST /api/prayers/:prayerType/uncomplete` that removes the completion mark for a specific prayer.
- **FR-004**: On every prayer completion or uncompletion, the backend MUST execute the following orchestration flow in order:
  1. Validate request: DTO validation, auth check, edit-window check (FR-020).
  2. Upsert or update the PrayerLog for the user, prayer type, and local date.
  3. Derive whether the affected local date is fully complete by counting completed PrayerLogs for that date.
  4. Recalculate the user's current streak dynamically by scanning backward from today through consecutive complete days derived from PrayerLog records. Stop at the first missed day.
  5. Write a PointTransaction when a day becomes complete (idempotent: only if no DAILY_COMPLETION transaction exists for that date). No negative or reversing transactions are written when a day becomes incomplete (FR-022 Points Permanence).
  6. Check and grant newly eligible awards based on the updated streak.
  7. Return the updated dashboard state to the frontend.
- **FR-005**: The backend MUST expose an authenticated API `GET /api/streaks/current` that returns the current streak count, longest streak (calculated dynamically from PrayerLog records), and the date range the current streak covers.
- **FR-006**: The backend MUST expose an authenticated API `GET /api/points/summary` that returns the user's total points (sum of all PointTransactions), a breakdown by reason, and recent transactions.
- **FR-007**: The backend MUST expose an authenticated API `GET /api/awards` that returns all awards with their earned/locked status and progress toward the next milestone.
- **FR-008**: The frontend MUST NOT calculate streaks, points, daily completeness, or award eligibility. It MUST render values returned by the backend.
- **FR-009**: The day boundary MUST be midnight in the user's configured IANA timezone. A day is considered "today" from 00:00:00 to 23:59:59 in that timezone.
- **FR-010**: Streak calculation MUST count consecutive calendar days (not prayer-to-prayer intervals) where all five required prayers were marked completed before the day's end. The current streak MUST be calculated dynamically from PrayerLog records on every relevant request.
- **FR-011**: A missed day (any day after the user's first recorded prayer where not all five prayers were completed) MUST break the streak.
- **FR-012**: Points MUST be awarded per-day via PointTransaction records: base points for completing all prayers, plus a streak bonus that increases with consecutive days.
- **FR-013**: Awards MUST be granted automatically when streak milestones are crossed. The initial milestones are 7-day streak, 15-day streak, and 30-day streak.
- **FR-014**: Once granted, awards MUST NOT be revoked even if the streak later breaks.
- **FR-015**: All API request bodies MUST be validated using NestJS DTOs with `class-validator` decorators. Invalid payloads MUST return HTTP 400 with a clear error message.
- **FR-016**: All API endpoints MUST require authentication. Unauthenticated requests MUST return HTTP 401.
- **FR-017**: Prayer log records MUST be private to the owning user. One user MUST NOT access another user's prayer logs.
- **FR-018**: The backend MUST handle timezone conversion correctly for day-boundary calculations using the user's configured IANA timezone string (e.g., "Africa/Cairo", "America/New_York").
- **FR-019**: The database MUST enforce a unique constraint on `(userId, date, prayerType)` in the PrayerLog table to guarantee idempotency and prevent duplicate records.
- **FR-020**: Users MAY edit prayer completion status for today and the previous 3 local calendar days only. The backend MUST reject attempts to modify prayer logs older than this window with HTTP 403 Forbidden.
- **FR-021**: Historical prayer logs MUST retain their original local `date` value even if the user later changes their configured timezone.
- **FR-022**: PointTransaction is an append-only ledger. Once a PointTransaction is written for a DAILY_COMPLETION, it MUST NOT be deleted, reversed, or modified — even if the user later uncompletes a prayer and the day becomes incomplete. Points remain permanently earned. Prayer edits, streak recalculations, or day-status changes do not remove, reverse, or adjust previously awarded points. No negative PointTransaction records SHOULD be created for uncompletion events.

### Key Entities

The V1 data model contains exactly four entities. No separate DailyCompletion, Points, or Streak tables are included. Streak is derived dynamically from PrayerLog records.

- **User**: Represents an app user. Key attributes: id, email, timezone (string IANA timezone, default UTC), createdAt.
- **PrayerLog**: Represents a single prayer marked complete by a user on a specific local date. Key attributes: id, userId, prayerType (enum: FAJR, DHUHR, ASR, MAGHRIB, ISHA), status (enum: COMPLETED, UNCOMPLETED), completedAt (timestamp), date (date in user's local timezone at time of creation). **Database constraint**: UNIQUE(userId, date, prayerType).
- **PointTransaction**: An append-only ledger entry for points earned. Key attributes: id, userId, points (integer, positive for earned), reason (enum: DAILY_COMPLETION, STREAK_BONUS, ADJUSTMENT), relatedDate (the local date the transaction pertains to), createdAt. Negative transactions for reversal are NOT created (FR-022 Points Permanence).
- **Award**: Represents a milestone award. Key attributes: id, userId, awardType (string, e.g., "STREAK"), milestone (integer, e.g., 7, 15, 30), grantedAt (nullable), createdAt.

### NestJS Service Architecture

The backend is organized into feature modules. Each module contains a controller and a service. The existing AuthModule is reused for authentication.

| Module | Controller | Service | Responsibility |
|--------|-----------|---------|----------------|
| **PrayersModule** | PrayersController | PrayersService | Handles prayer completion and uncompletion actions. Acts as the orchestrator after any PrayerLog change. |
| **StreaksModule** | StreaksController | StreaksService | Calculates current streak and longest streak dynamically from PrayerLog records. Provides streak data to DashboardService and PrayersService. |
| **PointsModule** | PointsController | PointsService | Manages PointTransaction ledger. Computes total points and breakdowns by summing transactions. |
| **AwardsModule** | AwardsController | AwardsService | Manages award records. Checks eligibility against configured milestones. Grants new awards. |
| **DashboardModule** | DashboardController | DashboardService | Aggregates data from PrayersService, StreaksService, PointsService, and AwardsService into a single response for `GET /api/dashboard`. |

**AuthModule** (existing) is reused. All controllers enforce authentication via guards.

### Orchestration Flow

When `POST /api/prayers/:prayerType/complete` or `POST /api/prayers/:prayerType/uncomplete` is called, **PrayersService** MUST execute the following ordered steps, delegating to other services as indicated:

1. **Validate request** (PrayersService): DTO validation, auth check, edit-window check (FR-020).
2. **Upsert PrayerLog** (PrayersService): Insert or update the prayer log for `(userId, date, prayerType)` within a Prisma transaction.
3. **Derive DailyCompleteness** (PrayersService): Count completed PrayerLogs for the affected local date. A day is complete only when all 5 prayer types are COMPLETED.
4. **Recalculate Streak** (PrayersService → StreaksService): Call StreaksService to calculate the current streak dynamically by scanning backward from today through consecutive complete days. Stop at the first missed day.
5. **Write PointTransaction** (PrayersService → PointsService): If the day changed from incomplete → complete, call PointsService to write a positive PointTransaction (idempotent: only if no existing DAILY_COMPLETION transaction exists for that date). If complete → incomplete, NO PointTransaction is written — points remain permanently earned per FR-022. Include streak bonus based on the new streak length.
6. **Check Awards** (PrayersService → AwardsService): Pass the new streak to AwardsService. AwardsService compares against configured milestones and grants any newly eligible awards.
7. **Return Dashboard State** (PrayersService → DashboardService): Assemble the updated dashboard response and return it to the frontend.

All database writes in steps 2–6 that affect multiple tables SHOULD occur within a Prisma transaction to maintain consistency.

### Award Configuration

Award milestones MUST NOT be hardcoded deeply inside business logic. For V1, streak milestone configuration is centralized in a single, discoverable location:

```typescript
const STREAK_MILESTONES = [7, 15, 30];
```

The Award entity stores:
- `awardType` (e.g., "STREAK")
- `milestone` (e.g., 7, 15, 30)
- `grantedAt` (nullable timestamp)

This model allows future milestones—such as 60 days, 100 days, 365 days, Ramadan awards, or perfect-month awards—to be added by extending the configuration array or adding new `awardType` values, without redesigning the core Award table or service logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can mark a prayer as completed in under 1 second from tap to UI update (backend response time < 200ms p95).
- **SC-002**: The backend correctly calculates daily completeness, streaks, points, and awards for 100% of test cases covering edge cases (timezone changes, missed days, out-of-order prayers, uncompletion).
- **SC-003**: 100% of API endpoints have DTO validation with `class-validator` and return HTTP 400 for invalid input with a descriptive error message.
- **SC-004**: Zero frontend-side calculation of streaks, points, or awards — verified by code review and automated lint rules.
- **SC-005**: All new backend logic has contract tests (API request/response shape) and at least one integration test per user story.
- **SC-006**: Prayer logs are inaccessible across user boundaries — verified by integration tests asserting 403/404 for cross-user access attempts.
- **SC-007**: No duplicate prayer logs can be created under concurrent requests — verified by load tests and unique constraint enforcement.
- **SC-008**: The `GET /api/dashboard` endpoint returns the full home-screen state in a single response with all required fields.
- **SC-009**: Points are fully auditable through PointTransaction records — every points change is traceable to a reason and date. The ledger is append-only; no transactions are deleted or reversed.
- **SC-010**: Prayer edit attempts outside the allowed window (today + previous 3 days) are rejected with HTTP 403.
- **SC-011**: Awards remain earned even if the streak later breaks — verified by integration tests that break a streak after granting an award and assert the award persists.
- **SC-012**: Streak is calculated dynamically from PrayerLog records — no Streak table exists in V1. Verified by schema inspection and service unit tests.
- **SC-013**: Points remain permanently earned once awarded. Uncompleting a prayer after a day was complete does NOT delete, reverse, or create a negative PointTransaction. Verified by integration tests.

## Assumptions

- Users have a configured timezone. If missing, the backend defaults to UTC and the frontend prompts the user to set one.
- The five daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) are the only prayers tracked in this feature. Sunnah or optional prayers are out of scope.
- Awards are limited to streak milestones (7, 15, 30) in this feature. Additional award types or milestones may be added later via the `awardType` + `milestone` model and configuration arrays.
- Points formula is: 10 base points per fully completed day + (streak length × 1) streak bonus points per day. Exact formula can be refined in implementation.
- The frontend already has a UI for displaying prayers, streaks, points, and awards. This feature only moves the calculation logic to the backend and updates the frontend to call APIs.
- User authentication is already implemented (e.g., JWT or session-based). This feature only requires that auth is enforced on the new endpoints.
- The existing frontend state management will be adjusted to fetch from APIs rather than computing locally.
- A cached Streak table may be added later as a performance optimization, but only if dynamic calculation from PrayerLog records proves insufficient under load.
