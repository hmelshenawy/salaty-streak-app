# Implementation Plan: Move Core Logic to Backend

**Branch**: `001-backend-core-logic` | **Date**: 2026-06-05 | **Spec**: [specs/001-backend-core-logic/spec.md](../spec.md)

**Input**: Feature specification from `/specs/001-backend-core-logic/spec.md`

**Critical Context**: Salaty Streak is an existing running application. This plan applies the spec incrementally—reusing existing modules, services, and APIs wherever possible, and migrating data carefully rather than replacing schemas blindly.

---

## Audit Summary: Existing State

### Existing Backend (`salaty-streak-backend/`)

**Modules already exist**: AuthModule, UsersModule, PrismaModule, PrayersModule, StreaksModule, DailySummaryModule, DashboardModule, MilestonesModule, PrayerTimesModule.

**Prisma schema already has**:
- `User` (id, name, email, password, gender, timezone, latitude, longitude)
- `PrayerLog` (id, userId, prayerName, date, status: ON_TIME/LATE/MISSED, prayedAt, inMosque, points)
- `DailySummary` (id, userId, date, totalPoints, completedPrayers, missedPrayers, isStreakDay)
- `Milestone` (id, title, targetDays, description, icon)
- `UserMilestone` (id, userId, milestoneId, reward, achievedAt, viewedAt)

**Key existing APIs**:
- `POST /prayers` — creates a prayer log with full DTO (prayerName, status, date, inMosque, prayedAt)
- `GET /prayers/today` — returns today's prayer logs
- `GET /prayers/history?month=` — returns monthly history
- `PUT /prayers/:id` — updates a prayer log
- `DELETE /prayers/:id` — removes a prayer log
- `GET /dashboard` — returns dashboard data (currentStreak, bestStreak, monthlyPoints, completionRate, todayPrayers, nextMilestone, prayerTimes)
- `GET /streaks/current` — returns { currentStreak, bestStreak }
- `GET /streaks/milestones` — returns all milestones with completion status
- `GET /streaks/next` — returns next milestone
- `GET /streaks/unviewed` — returns unviewed milestones

**Frontend already consumes**:
- Dashboard via `useDashboard()` hook
- Prayer creation via `prayersService.quickLog()` and `prayersService.create()`
- Milestones via `useMilestones()` hook
- All streak/points/award data comes from backend (frontend does not calculate these)

---

## Gap Analysis: Current vs. Spec

| Spec Requirement | Current State | Gap | Migration Strategy |
|--------------------|-------------|-----|-------------------|
| `POST /api/prayers/:prayerType/complete` | `POST /prayers` with full DTO | **Missing simple toggle endpoint** | Add new `POST /prayers/:prayerType/complete` and `POST /prayers/:prayerType/uncomplete` endpoints. Keep old endpoints during transition. |
| `GET /api/dashboard` returns unified home-screen state | `GET /dashboard` exists but returns different shape | **Response shape differs** | Update `DashboardService` to return spec-compliant shape. Keep backward-compatible fields where possible. |
| `GET /api/streaks/current` | `GET /streaks/current` exists | **Exists** | Update `StreaksService` to calculate dynamically from PrayerLog instead of DailySummary. Keep same response shape. |
| `GET /api/points/summary` | No dedicated points endpoint | **Missing** | Add `PointsModule` with `GET /points/summary`. Points currently computed per-prayer and stored on PrayerLog + DailySummary. |
| `GET /api/awards` | `GET /streaks/milestones` exists | **Different model** | Add `AwardsModule` with `GET /awards`. Migrate from Milestone/UserMilestone to Award table. |
| PointTransaction ledger | No PointTransaction table | **Missing table** | Add `PointTransaction` table. Migrate daily point data from DailySummary. |
| Award table (awardType + milestone) | Milestone + UserMilestone tables | **Different schema** | Add `Award` table. Seed with `STREAK_MILESTONES = [7, 15, 30]`. Migrate existing user achievements. |
| PrayerLog `status` = COMPLETED/UNCOMPLETED | PrayerLog `status` = ON_TIME/LATE/MISSED | **Semantic mismatch** | **Interpretation layer**: treat `ON_TIME` and `LATE` as `COMPLETED`, `MISSED` as `UNCOMPLETED`. No destructive schema change needed for V1. |
| Unique constraint on (userId, date, prayerType) | Unique constraint on (userId, date, prayerName) | **Exists** | Already enforced at DB level. No change needed. |
| Daily completion derived from PrayerLog | DailySummary table stores pre-computed data | **Redundant table** | Stop writing to DailySummary. Derive from PrayerLog. Keep table for rollback safety; drop in later migration. |
| Streak derived dynamically from PrayerLog | StreaksService reads from DailySummary | **Wrong source** | Refactor `StreaksService.calculateStreaks()` to scan PrayerLog records directly. |
| Edit window: today + previous 3 days | No edit window enforcement | **Missing rule** | Add edit-window validation to `update` and new `uncomplete` endpoints. |
| Orchestration flow in PrayersService | PrayersService calls DailySummaryService and MilestonesService separately | **Missing unified orchestration** | Refactor `PrayersService` to delegate to StreaksService, PointsService, AwardsService within a Prisma transaction. |
| Frontend only renders | Frontend already renders backend data | **Already compliant** | Minimal frontend changes: update hooks to call new endpoints, update types to match new dashboard shape. |

---

## Strangler Migration Strategy

This migration follows the **strangler fig pattern**: new functionality is built alongside the old system, gradually diverting traffic to the new implementation, while the old system remains fully operational until the new one is proven. No destructive changes are made to the existing schema or APIs.

**Hard rules for this migration**:
- No destructive Prisma migrations.
- No `DROP TABLE` statements.
- No column removals.
- No breaking API changes.
- Existing frontend must continue working during all phases.

---

### Phase 1: Add New Tables and APIs (Side-by-Side)

**Goal**: Build the new backend logic without touching the old one. The old and new systems coexist. Old endpoints and tables continue to work exactly as before.

**Schema (additive only)**:
```prisma
model PointTransaction {
  id          String      @id @default(uuid())
  userId      String
  points      Int
  reason      PointReason
  relatedDate DateTime    @db.Date
  createdAt   DateTime    @default(now())
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, relatedDate])
}

model Award {
  id        String    @id @default(uuid())
  userId    String
  awardType String
  milestone Int
  grantedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, awardType, milestone])
  @@index([userId, awardType])
}

enum PointReason {
  DAILY_COMPLETION
  STREAK_BONUS
  ADJUSTMENT
}
```

**Migration**: `npx prisma migrate dev --name add_point_transaction_and_award`

**New modules to create**:
- `PointsModule` with `GET /points/summary`
- `AwardsModule` with `GET /awards`

**New endpoints to add**:
- `POST /prayers/:prayerType/complete`
- `POST /prayers/:prayerType/uncomplete`

**Existing modules unchanged**:
- `DailySummaryModule` — continues writing to `DailySummary` as before
- `MilestonesModule` — continues writing to `Milestone`/`UserMilestone` as before
- `DashboardModule` — continues returning the same response shape
- `StreaksModule` — continues reading from `DailySummary` as before

**Data migration (one-time, idempotent)**:
1. Copy existing user milestones to Award table:
   ```sql
   INSERT INTO "Award" (id, "userId", "awardType", milestone, "grantedAt", "createdAt")
   SELECT gen_random_uuid(), um."userId", 'STREAK', m."targetDays", um."achievedAt", um."createdAt"
   FROM "UserMilestone" um
   JOIN "Milestone" m ON um."milestoneId" = m.id
   ON CONFLICT ("userId", "awardType", milestone) DO NOTHING;
   ```

2. (Optional) Backfill PointTransaction from DailySummary:
   ```sql
   INSERT INTO "PointTransaction" (id, "userId", points, reason, "relatedDate", "createdAt")
   SELECT gen_random_uuid(), "userId", "totalPoints", 'DAILY_COMPLETION', date, "createdAt"
   FROM "DailySummary"
   WHERE "totalPoints" > 0;
   ```

**Frontend impact**: None. Old hooks and components continue to work. New endpoints are available but not yet consumed.

---

### Phase 2: Compare and Validate

**Goal**: Verify that the new backend logic produces correct results before switching anything over. Run both old and new calculations in parallel and compare.

**Backend tasks**:
1. Implement `StreaksService` **new** calculation method that derives streaks directly from `PrayerLog`.
2. Implement `DashboardService` **new** aggregation method that uses `PointsService` and `AwardsService`.
3. Add an internal `/dashboard/compare` or logging-only endpoint that runs both old and new calculations for the same user and logs any differences.
4. Deploy to staging. Run the comparison against real user data for a representative sample of users.
5. Fix any discrepancies. Common sources of divergence: timezone boundary handling, edge cases in streak counting, missing prayers on a day.

**Validation checklist**:
- [ ] New streak calculation matches old `DailySummary`-based streak for 100% of users
- [ ] New dashboard points sum matches `DailySummary.totalPoints` for 100% of users
- [ ] New awards list covers all existing `UserMilestone` records
- [ ] No `DailySummary` writes are missed or duplicated

**Frontend impact**: None. This is backend-only validation. The frontend still uses the old dashboard response.

---

### Phase 3: Switch Dashboard to New Services (Strangle the Old Path)

**Goal**: Gradually shift the primary dashboard response to use the new services. The old calculation path remains as a fallback or for comparison logging.

**Backend tasks**:
1. Update `DashboardService.getDashboard()` to return the **new spec-compliant shape**.
2. Keep all old fields (`currentStreak`, `bestStreak`, `monthlyPoints`, `completionRate`, `todayPrayers`, `nextMilestone`, `prayerTimes`) in the response for backward compatibility.
3. Add new fields (`points`, `awards`, `timezone`) alongside the old ones.
4. Implement `PrayersService` orchestration flow: on `complete`/`uncomplete`, write to both:
   - **New path**: upsert PrayerLog → derive completeness → write PointTransaction → check Awards
   - **Old path**: recalculate DailySummary → check Milestones (kept for backward compatibility)
   This dual-write ensures both old and new systems stay in sync.

**Frontend tasks**:
1. Update `useDashboard()` hook types to accept the extended response shape.
2. Update `prayersService` to add `quickComplete(prayerName)` and `quickUncomplete(prayerName)` methods.
3. Update `PrayerCardList` to call the new toggle endpoints.
4. Update components that display points and awards to read from the new dashboard fields.
5. Keep all existing pages and routes. No page deletions.

**Rollback plan**: If issues are detected, revert the frontend to old endpoints and old dashboard field consumption. The backend old path is still active.

---

### Phase 4: Stop Writing Legacy Tables and Mark Deprecation

**Goal**: Once the new path is stable and frontend fully consumes new endpoints, stop writing to legacy tables. Mark legacy modules as deprecated but do not remove them yet.

**Backend tasks**:
1. In `PrayersService`, remove the old-path writes:
   - Stop calling `DailySummaryService.recalculate()`
   - Stop calling `MilestonesService.checkMilestones()`
   - Keep the old read endpoints (`GET /streaks/milestones`, etc.) working by reading from old tables
2. Add `@Deprecated()` JSDoc comments or logging to `DailySummaryService` and `MilestonesService` methods.
3. Continue running the comparison logging from Phase 2 for a cooldown period (e.g., 1 week) to catch any drift.

**Frontend tasks**:
1. Deprecate `useMilestones()` hook in favor of reading awards from the dashboard response.
2. Update any remaining components that call old endpoints.

**Important**: Legacy tables (`DailySummary`, `Milestone`, `UserMilestone`) are **not dropped**. They remain in the database for read-only access and rollback safety.

---

### Phase 5: Remove Legacy Tables (Future Separate Feature)

**Goal**: Clean up deprecated tables and modules. This is explicitly **out of scope** for this feature and should be planned as a separate future migration.

**Prerequisites before Phase 5 can begin**:
- New dashboard and endpoints have been stable in production for at least 2 weeks
- All frontend components have been confirmed to use only new endpoints
- Comparison logging shows zero discrepancies for the cooldown period
- A backup of legacy tables has been taken

**Future cleanup tasks** (not part of this plan):
- Remove `DailySummary` table and `DailySummaryModule`
- Remove `Milestone` and `UserMilestone` tables and `MilestonesModule`
- Remove deprecated `POST /prayers`, `PUT /prayers/:id`, `DELETE /prayers/:id` if no longer needed
- Drop `points` column from `PrayerLog`
- Drop `totalPoints` and `isStreakDay` columns from `DailySummary` before dropping table

---

## Updated Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS (same as existing)

**Primary Dependencies**: Already installed: NestJS 10.x, Prisma 5.x, @nestjs/common, class-validator, class-transformer, @prisma/client, date-fns, date-fns-tz.

**Storage**: PostgreSQL (already configured)

**Testing**: Jest + Supertest (already configured)

**Project Type**: Existing NestJS web service (incremental refactor)

**Performance Goals**: `GET /api/dashboard` < 200ms p95; `POST /api/prayers/:prayerType/complete` < 200ms p95

**Constraints**:
- No destructive schema changes in V1 migration.
- Existing users and data must be preserved.
- Old endpoints must remain functional during transition.
- Frontend must not break during backend rollout.

---

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Simplicity First** | ✅ Pass | Reuses 4 existing modules, adds only 2 new ones (Points, Awards). No greenfield rebuild. Incremental migration avoids big-bang risk. |
| **II. Privacy by Design** | ✅ Pass | Existing row-level access (userId scoping) preserved. New tables follow same pattern. Edit window added for mutability control. |
| **III. Mobile-First** | ✅ Pass | Single dashboard API already exists; shape is updated, not replaced. Frontend pages preserved. |
| **IV. Security by Design** | ✅ Pass | Existing auth guards reused. New endpoints get same guards. DTO validation on new endpoints. |
| **V. Spec-Driven Development** | ✅ Pass | API contracts updated in `contracts/`. DTOs added for new endpoints. Prisma migration planned. Tests required for new logic. |

---

## Updated Project Structure

### What Changes vs. What Stays

**Existing modules (KEEP and MODIFY)**:
- `AuthModule` — no changes
- `UsersModule` — no changes
- `PrismaModule` — no changes
- `PrayersModule` — add new controller methods, refactor service orchestration
- `StreaksModule` — refactor service to read from PrayerLog directly
- `DashboardModule` — update service response shape
- `PrayerTimesModule` — no changes (still included in dashboard)

**Existing modules (DEPRECATE during transition, remove later)**:
- `DailySummaryModule` — stop writing to it; remove in future cleanup
- `MilestonesModule` — stop writing to it; remove in future cleanup

**New modules (ADD)**:
- `PointsModule` — PointTransaction ledger
- `AwardsModule` — milestone awards

**Source code tree (showing changes only)**:

```text
salaty-streak-backend/src/
├── app.module.ts                    # MODIFY: add PointsModule, AwardsModule imports
├── prayers/
│   ├── prayers.controller.ts        # MODIFY: add POST /:prayerType/complete, POST /:prayerType/uncomplete
│   ├── prayers.service.ts           # MODIFY: add orchestration, edit-window check
│   └── dto/
│       └── prayer-params.dto.ts     # ADD: path param validation
├── streaks/
│   └── streaks.service.ts           # MODIFY: derive from PrayerLog instead of DailySummary
├── points/
│   ├── points.module.ts             # ADD
│   ├── points.controller.ts         # ADD: GET /points/summary
│   ├── points.service.ts            # ADD: ledger management
│   └── dto/
│       └── points-response.dto.ts   # ADD
├── awards/
│   ├── awards.module.ts             # ADD
│   ├── awards.controller.ts         # ADD: GET /awards
│   ├── awards.service.ts            # ADD: milestone checking + granting
│   ├── dto/
│   │   └── award-response.dto.ts    # ADD
│   └── config/
│       └── award.config.ts          # ADD: STREAK_MILESTONES
├── dashboard/
│   ├── dashboard.service.ts         # MODIFY: aggregate from new services
│   └── dto/
│       └── dashboard-response.dto.ts # MODIFY: extend shape
├── daily-summary/                   # DEPRECATE: stop using, remove later
└── milestones/                      # DEPRECATE: stop using, remove later
```

**Frontend tree (showing changes only)**:

```text
salaty-streak-frontend/src/
├── services/
│   ├── prayers.service.ts           # MODIFY: add quickComplete/quickUncomplete
│   └── dashboard.service.ts         # MODIFY: types updated
├── types/
│   ├── dashboard.ts                 # MODIFY: extend shape
│   └── award.ts                     # ADD (or extend milestone.ts)
├── hooks/
│   └── useDashboard.ts             # MODIFY: types updated
└── components/
    └── prayers/
        └── PrayerCardList.tsx       # MODIFY: call new toggle endpoints
```

---

## Complexity Tracking

No constitution violations. Complexity is justified and minimized through reuse:
- 2 new modules instead of 5 (Points + Awards). Prayers, Streaks, Dashboard updated in place.
- DailySummary and Milestones modules are deprecated, not duplicated.
- Schema migration is additive (new tables) rather than destructive (no column drops).
- Frontend pages are updated, not rewritten.

---

## Risk & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PrayerLog status semantics (ON_TIME/LATE vs COMPLETED) cause confusion | Medium | Medium | **Interpretation layer** in StreaksService and DashboardService: `ON_TIME` + `LATE` = "completed". Document this mapping. No schema change needed for V1. |
| Data migration from DailySummary to PointTransaction is lossy or incorrect | Low | High | Write a data-verification script that compares `SUM(DailySummary.totalPoints)` vs `SUM(PointTransaction.points)` per user after migration. Run in staging first. |
| New dashboard response shape breaks existing frontend | Medium | High | Keep old fields in dashboard response during transition. Add new fields alongside. Remove old fields only after frontend deploys updated types. |
| Concurrent requests during orchestration create inconsistent state | Low | High | Prisma `$transaction` wraps PrayerLog upsert + PointTransaction insert + Award check. The existing `UNIQUE(userId, date, prayerName)` constraint prevents duplicates. |
| Dynamic streak query from PrayerLog is slower than DailySummary lookup | Medium | Medium | Benchmark before and after. The query is bounded by scanning backward day-by-day with an indexed `date` column. If slower than 100ms for 1 year of data, add a query optimization (e.g., `GROUP BY date HAVING COUNT >= 5` subquery) instead of a cached table. |
| Edit window rule frustrates users who want to edit older logs | Low | Low | Window is today + 3 days, which is generous. Document the limitation. Admin override can be added later if requested. |

---

## Implementation Strategy

This implementation follows the **strangler migration pattern** defined above. Work is organized by strangler phase, not by user story. Each phase has a clear rollback point.

### Phase 1: Add New Tables and APIs (Side-by-Side)

**Goal**: Build new tables and endpoints without affecting existing functionality.

**Tasks**:
1. Run additive Prisma migration (`PointTransaction` + `Award` tables).
2. Create `PointsModule` with `GET /points/summary`.
3. Create `AwardsModule` with `GET /awards`.
4. Add `POST /prayers/:prayerType/complete` and `POST /prayers/:prayerType/uncomplete` to `PrayersController`.
5. Implement basic `PrayersService.complete()` and `uncomplete()` methods (write to PrayerLog only; no orchestration yet).
6. Run data migration scripts to populate `Award` table from existing `UserMilestone` data.
7. Add edit-window validation to new uncomplete endpoint.

**Validation gate**: All existing tests pass. New endpoints respond correctly when called manually. Frontend is untouched and still works.

### Phase 2: Compare and Validate (Parallel Calculation)

**Goal**: Prove the new logic is correct before switching anything over.

**Tasks**:
1. Implement `StreaksService.calculateStreaksFromPrayerLogs()` — dynamic calculation from PrayerLog.
2. Implement `PointsService.calculateFromLedger()` — sum of PointTransactions.
3. Implement `AwardsService.getAwardsFromNewTable()` — read from Award table.
4. Add internal comparison logging: for a configurable percentage of requests, run both old and new calculations and log any mismatch.
5. Deploy to staging. Run comparison against real user data.
6. Fix discrepancies if any.

**Validation gate**: Zero mismatches logged for 100% of sampled users over a full week of staging data.

### Phase 3: Switch Dashboard and Strangle the Old Path

**Goal**: Gradually move primary traffic to the new implementation. The old path remains as a safety net.

**Tasks**:
1. Implement full `PrayersService` orchestration flow:
   - Upsert PrayerLog
   - Derive daily completeness
   - Write PointTransaction (new path, idempotent — no negative/reversing transactions, per FR-022)
   - Recalculate streak via new method
   - Check and grant awards via new method
   - **Also** call `DailySummaryService.recalculate()` and `MilestonesService.checkMilestones()` (old path, dual-write)
2. Update `DashboardService.getDashboard()` to return the new spec-compliant shape with all old fields preserved.
3. Update frontend `useDashboard()` hook to accept new shape.
4. Update frontend `PrayerCardList` to call new toggle endpoints.
5. Update frontend points/awards display to read from new dashboard fields.

**Validation gate**: Dashboard loads correctly. Prayer toggles update the UI. Old fields in dashboard response still work if accessed by an old frontend version. Comparison logging continues with zero mismatches.

### Phase 4: Stop Writing Legacy Tables and Mark Deprecation

**Goal**: Cut over to new write path. Legacy tables become read-only.

**Tasks**:
1. Remove dual-write from `PrayersService`: stop calling `DailySummaryService.recalculate()` and `MilestonesService.checkMilestones()`.
2. Mark `DailySummaryService` and `MilestonesService` methods with deprecation warnings.
3. Continue comparison logging for a cooldown period (e.g., 1 week in production).
4. Update any remaining frontend components that still call old endpoints.
5. Deprecate `useMilestones()` hook.

**Validation gate**: No drift in comparison logging. All frontend components use new endpoints. Legacy tables are no longer written to (verify with query logging or DB triggers).

## Production Rollout Plan

**Status**: Phase 4 completed. Dual-write validation passed.

**Business Rule Adopted**: Option A — Points Permanence (FR-022). Once points are awarded via PointTransaction, they remain permanently earned. Prayer edits, streak recalculations, or day-status changes do not remove, reverse, or adjust previously awarded points. No negative PointTransaction records are created for uncompletion events.

### Stage 1: Dual-Write Only (Current)

**Configuration**:
```
USE_DUAL_WRITE=true
USE_NEW_STREAK_ENGINE=false
USE_NEW_DASHBOARD_ENGINE=false
```

**What happens**:
- Prayer toggles write to both old and new tables.
- DailySummary and UserMilestone continue updating (legacy path).
- PointTransaction and Award tables begin populating (new path).
- Dashboard continues returning old aggregation.
- Frontend continues using old fields.

**Monitoring**: 3–7 days. Watch for:
- Comparison logging mismatches (old vs new calculations)
- Duplicate PointTransaction entries (idempotency failures)
- Database performance on dual-write
- Error rates on toggle endpoints

**Rollback**: Set `USE_DUAL_WRITE=false`. Old system continues exactly as before.

### Stage 2: Enable New Engine

**Configuration**:
```
USE_DUAL_WRITE=true
USE_NEW_STREAK_ENGINE=true
USE_NEW_DASHBOARD_ENGINE=true
```

**What happens**:
- Dashboard returns new aggregation (PrayerLog-derived streak, PointTransaction-derived points, Award-derived milestones).
- Old fields remain in response for backward compatibility.
- Frontend can begin displaying new fields (`points`, `awards`, `timezone`).
- Dual-write continues keeping old tables in sync.

**Monitoring**: 3–7 days. Watch for:
- Dashboard parity mismatches
- Frontend rendering issues with new fields
- User-reported streak/points discrepancies

**Rollback**: Set `USE_NEW_STREAK_ENGINE=false` and `USE_NEW_DASHBOARD_ENGINE=false`. Dashboard reverts to old aggregation. Dual-write keeps old tables current.

### Stage 3: Phase 5 — Stop Legacy Writes (Future)

**Prerequisites**:
- Stage 2 has run in production for at least 1 week with zero issues
- Frontend fully consumes new dashboard fields
- Comparison logging shows zero mismatches for the full cooldown period
- All users' data has been verified

**Configuration**:
```
USE_DUAL_WRITE=false
USE_NEW_STREAK_ENGINE=true
USE_NEW_DASHBOARD_ENGINE=true
```

**What happens**:
- PrayersService stops calling `DailySummaryService.recalculate()` and `MilestonesService.checkMilestones()`.
- Legacy tables become read-only.
- Deprecation warnings added to legacy write methods.
- New tables (`PointTransaction`, `Award`) are the sole source of truth.

**Important**: Legacy tables (`DailySummary`, `Milestone`, `UserMilestone`) are **NOT dropped**. They remain for read-only access and rollback safety. Removal is a separate future cleanup feature.

**Rollback**: Re-enable `USE_DUAL_WRITE=true` to resume syncing old tables.

---

### Phase 5: Remove Legacy Tables (Future Separate Feature)

**Out of scope**. Plan as a separate feature after:
- 2+ weeks of stable production with new system
- Zero comparison mismatches during cooldown
- Confirmation that no frontend or external consumer reads legacy tables

---

### Parallel Team Strategy

With multiple developers, assign by strangler phase:

- **Developer A (Phase 1 + 3)**: PrayersModule toggle endpoints + orchestration flow + edit-window logic
- **Developer B (Phase 2 + 3)**: StreaksService new calculation + DashboardService aggregation + comparison logging
- **Developer C (Phase 1 + 2)**: PointsModule + AwardsModule + data migration scripts + validation tooling
- **Developer D (Phase 3)**: Frontend hook updates + component refactoring + integration testing
- **Lead**: Own comparison validation, coordinate phase gates, approve Phase 4 cutoff
