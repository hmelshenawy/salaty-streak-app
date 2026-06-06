# Tasks: Move Core Logic to Backend (Strangler Migration)

**Branch**: `001-backend-core-logic`
**Input**: Implementation plan from `specs/001-backend-core-logic/plan/plan.md`
**Strategy**: Strangler migration — new system built alongside old, gradual cutover, no destructive changes.

---

## Implementation Guardrails

These rules apply to **all phases**. They are non-negotiable.

- **Do not implement all tasks in one pass.** Complete one phase at a time.
- **Stop after each phase** and request validation before proceeding.
- **Do not perform destructive migrations.** Additive only.
- **Do not drop tables.** Legacy tables remain until a separate future cleanup feature.
- **Do not remove columns.** Existing schema columns are preserved.
- **Do not remove existing endpoints.** Old APIs stay operational.
- **Existing dashboard must remain functional** throughout migration.
- **Existing frontend must continue working** throughout migration.
- **Existing auth flow must remain unchanged.**
- **No breaking API changes.** Response shapes are extended, not replaced.

---

## Phase 1: Side-by-Side Schema and APIs

**Goal**: Add new tables and endpoints without touching existing functionality. Old system continues exactly as before.

**Tasks in this phase**:

### T100 VERIFY prisma/schema.prisma — audit existing models
**File**: `salaty-streak-backend/prisma/schema.prisma`
**Description**: Read-only audit of existing models before any schema changes. Document exact field mappings for: User, PrayerLog, DailySummary, Milestone, UserMilestone. Confirm whether any existing models already satisfy Award or PointTransaction requirements. No code changes. Output findings in implementation notes.
**Dependencies**: None

### T101 [P] ADD Prisma migration — PointTransaction table
**File**: `salaty-streak-backend/prisma/schema.prisma`
**Description**: Add `PointTransaction` model and `PointReason` enum to the Prisma schema. Use `npx prisma migrate dev --name add_point_transaction_and_award`.
**Dependencies**: T100

### T102 [P] ADD Prisma migration — Award table
**File**: `salaty-streak-backend/prisma/schema.prisma`
**Description**: Add `Award` model to the Prisma schema in the same migration as T101. Add relation fields to existing `User` model.
**Dependencies**: T100

### T103 ADD PrismaService relations update
**File**: `salaty-streak-backend/prisma/schema.prisma`
**Description**: Add `pointTransactions` and `awards` relation arrays to the existing `User` model. No changes to existing `PrayerLog`, `DailySummary`, `Milestone`, or `UserMilestone` models.
**Dependencies**: T101, T102

### T104 ADD PointsModule scaffold
**File**: `salaty-streak-backend/src/points/points.module.ts` (NEW)
**Description**: Create NestJS module with `PointsController` and `PointsService`. Import `PrismaModule`.
**Dependencies**: T103

### T105 ADD PointsController — GET /points/summary
**File**: `salaty-streak-backend/src/points/points.controller.ts` (NEW)
**Description**: Create controller with authenticated `GET /points/summary` endpoint. Use existing `JwtAuthGuard` (already global).
**Dependencies**: T104

### T106 ADD PointsService — ledger read
**File**: `salaty-streak-backend/src/points/points.service.ts` (NEW)
**Description**: Implement `getSummary(userId: string)` that returns `{ total, breakdown, recentTransactions }` by querying `PointTransaction` table. Return empty state if no transactions exist yet.
**Dependencies**: T104

### T107 ADD PointsResponseDto
**File**: `salaty-streak-backend/src/points/dto/points-response.dto.ts` (NEW)
**Description**: Define DTOs for points summary response using `class-validator` decorators.
**Dependencies**: T105

### T108 ADD AwardsModule scaffold
**File**: `salaty-streak-backend/src/awards/awards.module.ts` (NEW)
**Description**: Create NestJS module with `AwardsController` and `AwardsService`. Import `PrismaModule`.
**Dependencies**: T103

### T109 ADD AwardsController — GET /awards
**File**: `salaty-streak-backend/src/awards/awards.controller.ts` (NEW)
**Description**: Create controller with authenticated `GET /awards` endpoint. Use existing `JwtAuthGuard`.
**Dependencies**: T108

### T110 ADD AwardsService — read from new table
**File**: `salaty-streak-backend/src/awards/awards.service.ts` (NEW)
**Description**: Implement `getAwards(userId: string)` that queries `Award` table and returns `{ earned, locked, nextTarget }` based on `STREAK_MILESTONES = [7, 15, 30]`. Return empty state if no awards exist yet.
**Dependencies**: T108

### T111 ADD Award configuration file
**File**: `salaty-streak-backend/src/awards/config/award.config.ts` (NEW)
**Description**: Export `STREAK_MILESTONES = [7, 15, 30]` as the single source of truth for milestone configuration.
**Dependencies**: T110

### T112 ADD AwardsResponseDto
**File**: `salaty-streak-backend/src/awards/dto/award-response.dto.ts` (NEW)
**Description**: Define DTOs for awards response using `class-validator`.
**Dependencies**: T109

### T113 MODIFY AppModule — register PointsModule and AwardsModule
**File**: `salaty-streak-backend/src/app.module.ts`
**Description**: Add `PointsModule` and `AwardsModule` to the `imports` array. Keep all existing modules unchanged.
**Dependencies**: T104, T108

### T114 MODIFY PrayersController — add complete endpoint
**File**: `salaty-streak-backend/src/prayers/prayers.controller.ts`
**Description**: Add `POST /prayers/:prayerType/complete` handler. Path param must be validated to one of: fajr, dhuhr, asr, maghrib, isha. Accept existing `Request` type for user context.
**Dependencies**: None

### T115 MODIFY PrayersController — add uncomplete endpoint
**File**: `salaty-streak-backend/src/prayers/prayers.controller.ts`
**Description**: Add `POST /prayers/:prayerType/uncomplete` handler. Same path param validation as T114.
**Dependencies**: T114

### T116 ADD PrayerParamsDto
**File**: `salaty-streak-backend/src/prayers/dto/prayer-params.dto.ts` (NEW)
**Description**: DTO for path param validation with `@IsEnum(PrayerName)` and `@IsString()`.
**Dependencies**: T114

### T117 MODIFY PrayersService — add complete method (basic)
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Implement `complete(userId, prayerType, date)` that upserts a `PrayerLog` with status `ON_TIME` for the given date. Use existing `parseDateString` for date handling. Handle `P2002` unique constraint conflict (idempotent). **Do NOT** call DailySummaryService or MilestonesService yet.
**Dependencies**: T114

### T118 MODIFY PrayersService — add uncomplete method (basic)
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Implement `uncomplete(userId, prayerType, date)` that updates existing `PrayerLog` status to `MISSED` or deletes the log if it exists. Add edit-window check: reject if date is older than today + previous 3 days (return 403). **Do NOT** call DailySummaryService or MilestonesService yet.
**Dependencies**: T115, T117

### T119 ADD Data migration script — milestones to awards
**File**: `salaty-streak-backend/scripts/migrate-milestones-to-awards.ts` (NEW)
**Description**: Idempotent script that copies `UserMilestone` + `Milestone` data into `Award` table. Use `ON CONFLICT DO NOTHING` to prevent duplicates. Log count of migrated records.
**Dependencies**: T103

### T120 ADD Data migration script — backfill point transactions
**File**: `salaty-streak-backend/scripts/backfill-point-transactions.ts` (NEW)
**Description**: Idempotent script that creates `PointTransaction` records from `DailySummary` rows where `totalPoints > 0`. Use `ON CONFLICT` guard. Log count of backfilled records.
**Dependencies**: T103

---

### Phase 1 Tests

### T501 ADD Unit test — PointsService
**File**: `salaty-streak-backend/src/points/points.service.spec.ts` (NEW)
**Description**: Test `getSummary()` with empty ledger, single transaction, multiple transactions, mixed positive/negative values.
**Dependencies**: T106

### T502 ADD Unit test — AwardsService
**File**: `salaty-streak-backend/src/awards/awards.service.spec.ts` (NEW)
**Description**: Test `getAwards()` with no awards, earned awards, locked awards with progress.
**Dependencies**: T110

### T505 ADD Contract test — new toggle endpoints
**File**: `salaty-streak-backend/test/contract/prayers-toggle.contract-spec.ts` (NEW)
**Description**: Supertest contract tests for `POST /prayers/:prayerType/complete` and `POST /prayers/:prayerType/uncomplete`. Verify response shape, HTTP 400 for invalid prayer type, HTTP 401 without auth, HTTP 403 for edit-window violation.
**Dependencies**: T114, T115

### T506 ADD Contract test — points and awards endpoints
**File**: `salaty-streak-backend/test/contract/points-and-awards.contract-spec.ts` (NEW)
**Description**: Supertest contract tests for `GET /points/summary` and `GET /awards`. Verify response shapes, HTTP 401 without auth, correct data for authenticated user with seeded records.
**Dependencies**: T105, T109

### T508 ADD Integration test — backward compatibility
**File**: `salaty-streak-backend/test/integration/backward-compat.spec.ts` (NEW)
**Description**: Verify old endpoints still work: `POST /prayers`, `PUT /prayers/:id`, `DELETE /prayers/:id`, `GET /streaks/milestones`, `GET /streaks/next`, `GET /streaks/unviewed`, `GET /dashboard`. Assert response shapes match pre-migration expectations.
**Dependencies**: All Phase 1 backend tasks

### T509 VERIFY Existing test suite passes
**File**: `salaty-streak-backend/`
**Description**: Run `npm run test` and `npm run test:e2e`. All existing tests must pass with zero failures. Fix any regressions caused by new code.
**Dependencies**: All Phase 1 backend tasks

### T510 ADD Data migration verification test
**File**: `salaty-streak-backend/test/integration/data-migration.spec.ts` (NEW)
**Description**: Test the idempotency of data migration scripts. Run `migrate-milestones-to-awards.ts` twice — assert no duplicates. Compare `Award` count against `UserMilestone` count. Assert all milestones are represented.
**Dependencies**: T119

---

## STOP POINT #1

**Validation required before proceeding to Phase 2:**

- [ ] T100 audit findings documented and reviewed
- [ ] Prisma migration succeeds (`npx prisma migrate dev` completes without errors)
- [ ] New tables (`PointTransaction`, `Award`) appear in database
- [ ] `GET /points/summary` returns empty state correctly (200 OK)
- [ ] `GET /awards` returns empty state correctly (200 OK)
- [ ] `POST /prayers/:prayerType/complete` creates PrayerLog correctly (200/201)
- [ ] `POST /prayers/:prayerType/uncomplete` respects edit window (403 for old dates)
- [ ] Existing dashboard (`GET /dashboard`) still works exactly as before
- [ ] Existing APIs (`POST /prayers`, `PUT /prayers/:id`, `GET /streaks/current`, etc.) still work
- [ ] T509 passes: all existing tests pass with zero failures
- [ ] T508 passes: backward compatibility test passes
- [ ] Data migration scripts run successfully and are idempotent

**If any check fails**: Do not proceed. Fix the issue and re-run validation.

---

## Phase 2: Parallel Validation

**Goal**: Run new and old calculations side-by-side. Log mismatches. Fix discrepancies. Do not switch any production traffic yet.

---

### T201 MODIFY StreaksService — add calculateFromPrayerLogs method
**File**: `salaty-streak-backend/src/streaks/streaks.service.ts`
**Description**: Add new method `calculateStreaksFromPrayerLogs(userId)` that derives daily completeness from `PrayerLog` records directly. A day is complete when all 5 prayer names have status `ON_TIME` or `LATE`. Scan backward from today (or yesterday if today incomplete and before midnight) counting consecutive complete days. Return `{ currentStreak, bestStreak }` in the same shape as existing method.
**Dependencies**: T103

### T202 MODIFY StreaksService — add comparison logging
**File**: `salaty-streak-backend/src/streaks/streaks.service.ts`
**Description**: Add internal `compareStreakCalculations(userId)` method that calls both old (`calculateStreaks` from DailySummary) and new (`calculateStreaksFromPrayerLogs` from PrayerLog) methods. If results differ, log structured warning with userId, old result, new result, and timestamp. Enable via environment variable `ENABLE_STREAK_COMPARISON=true`.
**Dependencies**: T201

### T203 MODIFY DashboardService — add new aggregation path (internal)
**File**: `salaty-streak-backend/src/dashboard/dashboard.service.ts`
**Description**: Add private `getDashboardFromNewServices(userId)` method that assembles dashboard data using PointsService and AwardsService (new tables). Return shape matches spec-compliant dashboard structure. Do NOT expose this publicly yet.
**Dependencies**: T106, T110

### T204 MODIFY DashboardService — add comparison endpoint
**File**: `salaty-streak-backend/src/dashboard/dashboard.service.ts` and `salaty-streak-backend/src/dashboard/dashboard.controller.ts`
**Description**: Add internal `GET /dashboard/compare` (or logging-only middleware) that runs both old `getDashboard()` and new `getDashboardFromNewServices()` for the authenticated user. Log any field mismatches (currentStreak, bestStreak, points total, award count). Guard with env var `ENABLE_DASHBOARD_COMPARISON=true`. This endpoint is NOT consumed by the frontend.
**Dependencies**: T203

### T205 ADD Validation test — streak parity
**File**: `salaty-streak-backend/test/integration/streak-comparison.spec.ts` (NEW)
**Description**: Integration test that creates prayer logs for a test user, runs both old and new streak calculations, and asserts they produce identical `currentStreak` and `bestStreak` for known scenarios: empty history, 5-day streak, broken streak, single day, missed day.
**Dependencies**: T201

### T206 ADD Validation test — dashboard parity
**File**: `salaty-streak-backend/test/integration/dashboard-comparison.spec.ts` (NEW)
**Description**: Integration test that seeds test data (prayer logs, daily summaries, milestones), calls both old and new dashboard assembly paths, and asserts key metrics match: streak counts, points totals, award counts, today prayer completion status.
**Dependencies**: T204

### T207 ADD PointsService — write method (preparation for Phase 3)
**File**: `salaty-streak-backend/src/points/points.service.ts`
**Description**: Add `writeTransaction(userId, points, reason, relatedDate)` method for internal use by PrayersService orchestration. This is NOT exposed as an HTTP endpoint.
**Dependencies**: T106

### T208 ADD AwardsService — grant method (preparation for Phase 3)
**File**: `salaty-streak-backend/src/awards/awards.service.ts`
**Description**: Add `grantAwardsIfEligible(userId, currentStreak)` method that checks `STREAK_MILESTONES` against the provided streak and creates `Award` records for any newly reached milestones. Use `upsert` with `@@unique([userId, awardType, milestone])` to ensure idempotency. This is NOT exposed as an HTTP endpoint.
**Dependencies**: T110

---

### Phase 2 Tests

### T503 ADD Unit test — StreaksService new calculation
**File**: `salaty-streak-backend/src/streaks/streaks.service.spec.ts` (NEW or extend existing)
**Description**: Test `calculateStreaksFromPrayerLogs()` for scenarios: no logs, complete today, incomplete today before midnight, missed yesterday, 5-day streak, broken streak, out-of-order prayer completion. Assert `currentStreak` and `bestStreak` match expected values.
**Dependencies**: T201

---

## STOP POINT #2

**Validation required before proceeding to Phase 3:**

- [ ] T201 implemented: new streak calculation method exists and returns correct shape
- [ ] T202 active: comparison logging is running and capturing data
- [ ] T203 implemented: new dashboard aggregation path exists internally
- [ ] T204 active: dashboard comparison endpoint returns results
- [ ] T205 passes: streak parity test passes for all scenarios
- [ ] T206 passes: dashboard parity test passes
- [ ] T503 passes: StreaksService unit tests pass
- [ ] T509 still passes: existing test suite unchanged
- [ ] **Zero unresolved mismatches** logged by comparison tooling for a representative sample of users

**If mismatches are found**:
- Log the mismatch details (userId, field, old value, new value, date).
- Fix the discrepancy in the new calculation.
- Re-run comparison until zero mismatches for 100% of sampled users.
- **Do not proceed to Phase 3 until mismatches are resolved.**

---

## Phase 3: Dashboard Switch and Dual-Write

**Goal**: Move primary dashboard response to new services. Implement orchestration with dual-write to both old and new tables. Keep old fields for compatibility.

---

### T301A MODIFY PrayersService — add orchestration flow
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Refactor `complete()` and `uncomplete()` methods to execute the orchestration flow within a Prisma `$transaction`:
1. Upsert PrayerLog
2. Derive daily completeness (count completed PrayerLogs for the date)
3. Recalculate streak via new StreaksService method
4. Return updated state
**Dependencies**: T117, T118, T201

### T301B MODIFY PrayersService — integrate PointsService
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Extend the orchestration flow from T301A to call `PointsService.writeTransaction()` when a day becomes complete (positive transaction only). No negative or reversing transactions are written when a day becomes incomplete — points remain permanently earned per FR-022. Include streak bonus based on new streak length.
**Dependencies**: T301A, T207

### T301C MODIFY PrayersService — integrate AwardsService
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Extend the orchestration flow from T301B to call `AwardsService.grantAwardsIfEligible()` after streak recalculation. Pass the new streak count to the awards check.
**Dependencies**: T301B, T208

### T301D MODIFY PrayersService — add dual-write support
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Extend the orchestration flow from T301C to also call `dailySummaryService.recalculate()` and `milestonesService.checkMilestones()` (old path) within the same Prisma `$transaction`. This keeps old tables in sync with new tables. Both paths succeed or fail together.
**Dependencies**: T301C

### T302 MODIFY DashboardService — switch primary response shape
**File**: `salaty-streak-backend/src/dashboard/dashboard.service.ts`
**Description**: Update `getDashboard()` to return the spec-compliant response shape. Populate new fields (`points`, `awards`, `timezone`) from new services (PointsService, AwardsService, StreaksService new method). Keep ALL existing fields (`currentStreak`, `bestStreak`, `monthlyPoints`, `completionRate`, `todayPrayers`, `nextMilestone`, `prayerTimes`) populated from existing services for backward compatibility. The old fields should continue to return the same values as before.
**Dependencies**: T203, T301D

### T303 MODIFY DashboardResponseDto — extend shape
**File**: `salaty-streak-backend/src/dashboard/dto/dashboard-response.dto.ts`
**Description**: Add new DTO properties for `points`, `awards`, and `timezone` sections. Keep existing properties unchanged. Add `@IsOptional()` or union types so the DTO accepts both old and new shapes during transition.
**Dependencies**: T302

### T304 MODIFY StreaksController — switch to new calculation
**File**: `salaty-streak-backend/src/streaks/streaks.controller.ts`
**Description**: Update `GET /streaks/current` to use the new `calculateStreaksFromPrayerLogs()` method. Keep the response shape `{ currentStreak, bestStreak }` exactly the same so the frontend sees no difference.
**Dependencies**: T201

### T305 ADD Dashboard comparison cooldown logging
**File**: `salaty-streak-backend/src/dashboard/dashboard.service.ts`
**Description**: After switching the primary dashboard to new services, continue running the comparison from Phase 2 in the background for a cooldown period (e.g., 1 week). Log mismatches at `warn` level. If mismatches are detected, alert immediately. If zero mismatches after cooldown, disable comparison to save resources.
**Dependencies**: T302

---

### Phase 3 Tests

### T504 ADD Unit test — PrayersService orchestration
**File**: `salaty-streak-backend/src/prayers/prayers.service.spec.ts` (NEW or extend existing)
**Description**: Test `complete()` orchestration: verify PrayerLog upsert, PointTransaction write, Award grant if eligible. Test `uncomplete()` orchestration: verify PrayerLog update/delete, streak recalculation, and that **no negative PointTransaction is created** (FR-022). Test edit-window rejection. Test dual-write: verify both old and new tables are updated.
**Dependencies**: T301D

### T507 ADD Integration test — full toggle flow
**File**: `salaty-streak-backend/test/integration/prayer-toggle-flow.spec.ts` (NEW)
**Description**: End-to-end test: authenticate user, call `complete` for all 5 prayers across 3 days, verify dashboard shows streak=3, points>0, awards granted. Call `uncomplete` for one prayer, verify streak drops, and verify **points are NOT adjusted** (FR-022 Points Permanence). PointTransaction count must remain unchanged after uncomplete.
**Dependencies**: T301D, T302

### T515 ADD Integration test — dual-write validation
**File**: `salaty-streak-backend/test/integration/dual-write-validation.spec.ts` (NEW)
**Description**: End-to-end dual-write validation with `USE_DUAL_WRITE=true`:
1. Complete 1 prayer → verify PrayerLog + DailySummary updated, no PointTransaction yet.
2. Complete all 5 prayers → verify PointTransaction created, DailySummary `isStreakDay=true`, awards checked.
3. Re-complete same prayer → verify idempotency (no duplicate PointTransaction or Award).
4. Uncomplete one prayer → verify PrayerLog updated to MISSED, DailySummary `isStreakDay=false`, **PointTransaction count unchanged** (FR-022).
5. Re-complete after uncomplete → verify streak restored, still only 1 PointTransaction.
6. Dashboard reflects correct state.
**Status**: ✅ Completed during dual-write validation.
**Dependencies**: T301D, T302

---

## STOP POINT #3

**Validation required before proceeding to Phase 4:**

- [ ] T301D implemented: orchestration flow with dual-write is active
- [ ] T302 implemented: dashboard returns new shape with old fields preserved
- [ ] T304 implemented: streaks endpoint uses new calculation with same response shape
- [ ] T504 passes: PrayersService orchestration unit tests pass
- [ ] T507 passes: full toggle flow integration test passes
- [ ] T509 passes: all existing tests still pass
- [ ] Dashboard comparison logging (T305) shows zero mismatches
- [ ] **Rollback confirmed**: old dashboard fields still populate correctly for an old frontend version

**If any check fails**: Revert dashboard to old aggregation path (keep new endpoints available). Fix issue and re-validate.

---

## Phase 4: Frontend Updates

**Goal**: Update frontend to consume new endpoints and display new fields. Existing pages continue working.

---

### T306 ADD Frontend type — updated DashboardResponse
**File**: `salaty-streak-frontend/src/types/dashboard.ts`
**Description**: Extend `DashboardResponse` interface to include new fields (`points`, `awards`, `timezone`) while keeping all existing fields. Use optional (`?`) for new fields so old responses still type-check.
**Dependencies**: T302

### T601 ADD Frontend type — Award
**File**: `salaty-streak-frontend/src/types/award.ts` (NEW)
**Description**: Define `Award`, `EarnedAward`, `LockedAward`, `NextAwardTarget` interfaces matching the new dashboard awards shape.
**Dependencies**: T306

### T602 MODIFY Frontend dashboard types — extend with awards and points
**File**: `salaty-streak-frontend/src/types/dashboard.ts`
**Description**: Import and add `awards` and `points` fields to `DashboardResponse`. Keep all existing fields. Make new fields optional.
**Dependencies**: T601

### T307 MODIFY Frontend prayersService — add toggle methods
**File**: `salaty-streak-frontend/src/services/prayers.service.ts`
**Description**: Add `quickComplete(prayerName: PrayerName): Promise<DashboardResponse>` and `quickUncomplete(prayerName: PrayerName): Promise<DashboardResponse>` methods. These call the new backend toggle endpoints and return the updated dashboard state.
**Dependencies**: T114, T115

### T603 MODIFY Frontend prayers service — add toggle methods with types
**File**: `salaty-streak-frontend/src/services/prayers.service.ts`
**Description**: Add typed `quickComplete(prayerName)` and `quickUncomplete(prayerName)` methods returning `Promise<DashboardResponse>`. Keep all existing methods unchanged.
**Dependencies**: T307, T602

### T604 MODIFY Frontend dashboard service — no changes needed (types only)
**File**: `salaty-streak-frontend/src/services/dashboard.service.ts`
**Description**: No code changes required — the endpoint is the same (`/dashboard`). Only the response type changes (handled by T602).
**Dependencies**: T602

### T605 MODIFY Frontend useDashboard hook — handle extended shape
**File**: `salaty-streak-frontend/src/hooks/useDashboard.ts`
**Description**: No runtime logic changes needed if types are updated. Add comment noting the extended shape. Ensure `refresh()` is called after prayer toggle so the dashboard re-fetches.
**Dependencies**: T602

### T606 MODIFY Frontend PrayerCard — support toggle action
**File**: `salaty-streak-frontend/src/components/prayers/PrayerCard.tsx`
**Description**: If not already present, add an `onToggle` callback prop that calls `quickComplete` or `quickUncomplete` based on current status. Keep existing `onLog` prop for full form entry if it exists.
**Dependencies**: T603

### T308 MODIFY Frontend PrayerCardList — use toggle endpoints
**File**: `salaty-streak-frontend/src/components/prayers/PrayerCardList.tsx`
**Description**: Update prayer completion toggle to call `prayersService.quickComplete()` / `quickUncomplete()` instead of the full `prayersService.create()` flow. Pass the returned dashboard state to the parent or refresh hook.
**Dependencies**: T307

### T607 MODIFY Frontend TodayProgressCard — display points from new field
**File**: `salaty-streak-frontend/src/components/dashboard/TodayProgressCard.tsx`
**Description**: Update to display `data.points?.total` if available, falling back to `data.monthlyPoints`. Keep all existing display logic.
**Dependencies**: T602

### T608 MODIFY Frontend PointsCard — display points breakdown
**File**: `salaty-streak-frontend/src/components/dashboard/PointsCard.tsx`
**Description**: Update to display `data.points.breakdown` if available: daily completion points and streak bonus points.
**Dependencies**: T602

### T609 MODIFY Frontend StreakCard — no changes (data shape preserved)
**File**: `salaty-streak-frontend/src/components/dashboard/StreakCard.tsx`
**Description**: Verify that `data.currentStreak` and `data.bestStreak` continue to work. No code changes needed if these fields remain in the dashboard response.
**Dependencies**: T302

### T610 MODIFY Frontend CompletionRateCard — no changes
**File**: `salaty-streak-frontend/src/components/dashboard/CompletionRateCard.tsx`
**Description**: Verify `data.completionRate` continues to be populated. No code changes needed.
**Dependencies**: T302

### T611 MODIFY Frontend MilestoneCard — consume award data
**File**: `salaty-streak-frontend/src/components/streaks/MilestoneCard.tsx`
**Description**: Update to accept either old `Milestone` type or new `Award` type. Display `awardType`, `milestone`, `grantedAt` for earned awards; `progress` and `target` for locked awards.
**Dependencies**: T601

### T309 MODIFY Frontend dashboard page — consume new fields
**File**: `salaty-streak-frontend/src/app/(authenticated)/dashboard/page.tsx`
**Description**: Update to display new dashboard fields (`points`, `awards`, `timezone`) if present. Keep existing field consumption unchanged. Add conditional rendering so the page works with both old and new response shapes.
**Dependencies**: T306

### T310 MODIFY Frontend streaks page — consume new fields
**File**: `salaty-streak-frontend/src/app/(authenticated)/streaks/page.tsx`
**Description**: Update to display award data from `data.awards` if available, falling back to `data.nextMilestone` if not. Keep all existing display logic.
**Dependencies**: T306

### T612 MODIFY Frontend settings page — timezone display
**File**: `salaty-streak-frontend/src/app/(authenticated)/settings/page.tsx`
**Description**: If the settings page displays timezone, update to show `data.timezone.value` and `data.timezone.isDefaulted` from the dashboard response. Fallback to existing user profile API if dashboard data is not available.
**Dependencies**: T602

### T613 VERIFY Frontend build passes
**File**: `salaty-streak-frontend/`
**Description**: Run `npm run build`. No TypeScript errors. No lint errors. All pages compile.
**Dependencies**: All frontend tasks T601–T612

### T614 VERIFY Frontend dev server runs
**File**: `salaty-streak-frontend/`
**Description**: Run `npm run dev`. App loads. Login works. Dashboard loads. Prayer toggles work. Streaks page loads. No console errors.
**Dependencies**: T613

---

## STOP POINT #4

**Validation required before proceeding to Phase 5:**

- [ ] T613 passes: frontend build succeeds with zero errors
- [ ] T614 passes: frontend dev server runs correctly
- [ ] Dashboard page displays new fields when available
- [ ] Prayer toggle actions call new endpoints and refresh dashboard
- [ ] Streaks page displays award data when available, falls back to milestone data
- [ ] Old frontend screens remain functional
- [ ] No console errors in browser

**If any check fails**: Fix frontend issue. Do not proceed to Phase 5.

---

## Phase 5: Stop Legacy Writes and Mark Deprecation

**Goal**: Cut over to new write path. Legacy tables become read-only. Deprecation warnings added. Cooldown logging continues.

**Scope note**: Frontend milestone UI deprecation (T404, T405) is **out of scope** for this feature. It will be handled in a future cleanup feature after the new Award flow is fully validated in production.

---

### T401 MODIFY PrayersService — remove dual-write old path
**File**: `salaty-streak-backend/src/prayers/prayers.service.ts`
**Description**: Remove calls to `dailySummaryService.recalculate()` and `milestonesService.checkMilestones()` from the orchestration flow. The new path (PointsService + AwardsService + StreaksService) remains. Keep the `Prisma $transaction` wrapper.
**Dependencies**: T301D

### T402 MODIFY DailySummaryService — add deprecation warnings
**File**: `salaty-streak-backend/src/daily-summary/daily-summary.service.ts`
**Description**: Add `console.warn('[DEPRECATED] DailySummaryService is no longer maintained.')` at the top of `recalculate()` and any other write methods. These methods are kept for rollback safety but clearly marked.
**Dependencies**: T401

### T403 MODIFY MilestonesService — add deprecation warnings
**File**: `salaty-streak-backend/src/milestones/milestones.service.ts`
**Description**: Add `console.warn('[DEPRECATED] MilestonesService is no longer maintained.')` at the top of `checkMilestones()`, `setReward()`, and any other write methods. Keep read methods (`getMilestones`, `getNextMilestone`, `getUnviewedMilestones`) without deprecation since they may still serve old frontend consumers.
**Dependencies**: T401

### T406 ADD Cooldown comparison monitoring
**File**: `salaty-streak-backend/src/dashboard/dashboard.service.ts` or new `salaty-streak-backend/src/common/monitoring/comparison-monitor.ts`
**Description**: Add scheduled or per-request comparison logging that runs for a configurable cooldown period (default 7 days) after Phase 5 begins. If any mismatch is detected between old and new calculations, emit a structured log entry. After cooldown with zero mismatches, disable the comparison.
**Dependencies**: T305

---

### Phase 5 Tests

### T509 VERIFY Existing test suite passes
**File**: `salaty-streak-backend/`
**Description**: Run `npm run test` and `npm run test:e2e`. All existing tests must pass with zero failures. Fix any regressions caused by new code.
**Dependencies**: All Phase 5 backend tasks

---

## STOP POINT #5 (Final)

**Validation required to mark this feature complete:**

- [ ] T401 implemented: dual-write removed, only new path writes data
- [ ] T402/T403 implemented: deprecation warnings active on legacy write methods
- [ ] T406 active: cooldown comparison monitoring is running
- [ ] T509 passes: all existing tests still pass
- [ ] Legacy tables (`DailySummary`, `Milestone`, `UserMilestone`) are no longer being written to (verify via query logging)
- [ ] New tables (`PointTransaction`, `Award`) are being written to correctly
- [ ] Dashboard comparison logging shows zero mismatches during cooldown
- [ ] Frontend milestone UI still works (not deprecated yet — future cleanup feature)

**If any check fails**: Do not mark feature complete. Fix and re-validate.

---

## Future Cleanup Feature (Out of Scope)

The following tasks are **not part of this migration** and will be planned as a separate future feature:

- **T404** — Deprecate `useMilestones.ts` frontend hook
- **T405** — Update `MilestoneList.tsx` to consume dashboard awards exclusively
- Remove `DailySummary` table and `DailySummaryModule`
- Remove `Milestone` and `UserMilestone` tables and `MilestonesModule`
- Remove deprecated `POST /prayers`, `PUT /prayers/:id`, `DELETE /prayers/:id` if no longer needed
- Drop `points` column from `PrayerLog`

**Prerequisites for future cleanup**:
- New dashboard and endpoints stable in production for 2+ weeks
- Zero comparison mismatches during cooldown period
- Confirmation that no frontend or external consumer reads legacy tables

---

## Cross-Phase Dependencies Summary

| Phase | Cannot Start Until |
|-------|-------------------|
| Phase 2 | Phase 1 complete + STOP POINT #1 passed |
| Phase 3 | Phase 2 complete + STOP POINT #2 passed (zero mismatches) |
| Phase 4 | Phase 3 complete + STOP POINT #3 passed |
| Phase 5 | Phase 4 complete + STOP POINT #4 passed |

**Critical path**: T100 → T101 → T103 → T104/T108 → T106/T110 → T201 → T203 → T301A → T301B → T301C → T301D → T302 → T306 → T308 → T401 → T402/T403 → T509

**Rollback trigger per phase**:
- **Phase 1 → 2**: If Prisma migration fails or existing tests break, revert migration and fix schema.
- **Phase 2 → 3**: If comparison logging shows unresolved mismatches after 2 business days, pause. New endpoints remain available but dashboard primary path stays on old system.
- **Phase 3 → 4**: If dashboard switch causes issues, revert `DashboardService` to old aggregation path. Dual-write keeps old tables current.
- **Phase 4 → 5**: If frontend breaks, revert frontend to old endpoint consumption. Backend is unaffected.
- **Phase 5**: If stopping legacy writes causes drift in comparison logging, re-enable dual-write (T401 revert) and investigate.
