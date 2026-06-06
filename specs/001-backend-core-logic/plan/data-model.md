# Data Model: Move Core Logic to Backend

**Input**: Feature specification from `specs/001-backend-core-logic/spec.md`

**Context**: This is an incremental migration. The existing schema is preserved; new tables are added alongside it. Destructive changes are deferred to a future cleanup migration.

---

## Existing Schema (Preserved)

The following models already exist in `prisma/schema.prisma` and are **kept unchanged** in V1:

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  password  String
  gender    Gender?
  timezone  String   @default("Asia/Dubai")
  latitude  Float?
  longitude Float?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  prayerLogs     PrayerLog[]
  dailySummaries DailySummary[]
  milestones     UserMilestone[]
  // NEW relations added below
  pointTransactions PointTransaction[]
  awards            Award[]
}

model PrayerLog {
  id         String     @id @default(uuid())
  userId     String
  prayerName PrayerName // FAJR, DHUHR, ASR, MAGHRIB, ISHA
  date       DateTime
  status     PrayerStatus // ON_TIME, LATE, MISSED
  prayedAt   DateTime?
  inMosque   Boolean    @default(false)
  points     Int        @default(0)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, prayerName])
  @@index([userId, date])
}

// DEPRECATED during transition — stop writing, keep table for safety
model DailySummary {
  id               String   @id @default(uuid())
  userId           String
  date             DateTime
  totalPoints      Int      @default(0)
  completedPrayers Int      @default(0)
  missedPrayers    Int      @default(0)
  isStreakDay      Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId, date])
}

// DEPRECATED during transition — stop writing, keep table for safety
model Milestone {
  id          String          @id @default(uuid())
  title       String          @unique
  targetDays  Int             @unique
  description String?
  icon        String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  userMilestones UserMilestone[]
}

// DEPRECATED during transition — stop writing, keep table for safety
model UserMilestone {
  id          String    @id @default(uuid())
  userId      String
  milestoneId String
  reward      String?
  achievedAt  DateTime  @default(now())
  viewedAt    DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  milestone Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)

  @@unique([userId, milestoneId])
  @@index([userId])
  @@index([userId, viewedAt])
}

enum Gender { MALE FEMALE }
enum PrayerName { FAJR DHUHR ASR MAGHRIB ISHA }
enum PrayerStatus { ON_TIME LATE MISSED }
```

---

## New Schema (Added in V1 Migration)

The following models are **new** and added via `prisma migrate dev`:

```prisma
model PointTransaction {
  id          String      @id @default(uuid())
  userId      String
  points      Int
  reason      PointReason
  relatedDate DateTime    @db.Date
  createdAt   DateTime    @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, relatedDate])
}

model Award {
  id        String    @id @default(uuid())
  userId    String
  awardType String
  milestone Int
  grantedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, awardType, milestone])
  @@index([userId, awardType])
}

enum PointReason {
  DAILY_COMPLETION
  STREAK_BONUS
  ADJUSTMENT
}
```

---

## Semantic Mapping: Existing Status → New Logic

The spec defines prayer status as `COMPLETED` / `UNCOMPLETED`. The existing schema uses `ON_TIME` / `LATE` / `MISSED`. No destructive enum change is required for V1. The backend services apply the following interpretation layer:

| Existing Status | Spec Equivalent | Meaning |
|-----------------|-----------------|---------|
| `ON_TIME` | `COMPLETED` | Prayer was performed on time |
| `LATE` | `COMPLETED` | Prayer was performed late |
| `MISSED` | `UNCOMPLETED` | Prayer was missed |
| No log for a prayer | `UNCOMPLETED` | Prayer not yet logged |

**Daily Completeness Rule** (using existing schema):
A local calendar date is fully complete when the user has 5 `PrayerLog` records for that date where `status` is `ON_TIME` or `LATE`.

SQL equivalent (conceptual):
```sql
SELECT date
FROM PrayerLog
WHERE userId = ? AND status IN ('ON_TIME', 'LATE')
GROUP BY date
HAVING COUNT(DISTINCT prayerName) = 5;
```

---

## Derivation Rules

### Streak Calculation (Dynamic from PrayerLog)

The current streak is calculated dynamically by scanning backward from today through consecutive complete days.

Algorithm:
1. Determine "reference date":
   - If today is fully complete → reference date = today.
   - If today is incomplete and the current local time is before midnight in the user's timezone → reference date = yesterday (today may still become complete).
   - If today is incomplete and the current local time is after midnight → reference date = yesterday (today is missed).
2. Starting from the reference date, move backward one day at a time.
3. For each day, check if it is fully complete using the Daily Completeness rule above.
4. Continue counting while days are complete.
5. Stop at the first incomplete or missed day.
6. The count of consecutive complete days = current streak.

### Longest Streak

For V1, longest streak is calculated dynamically by scanning the entire prayer history:
1. Group history into runs of consecutive complete days.
2. Return the maximum run length.

*Note*: This is O(n) over the user's full history. If performance degrades, a cached column can be added later.

### Points Calculation

Total points = `SUM(points)` across all `PointTransaction` records for the user.

Points are written per-day when a day becomes fully complete:
- Base: 10 points for completing all 5 prayers.
- Bonus: `streakLength × 1` points (streak length at the time the day became complete).

**Points Permanence Rule** (FR-022): If a day later becomes incomplete (via uncompletion), **no reversing or negative transaction is written**. PointTransaction is an append-only ledger. Points remain permanently earned. The `ADJUSTMENT` reason exists for future admin-level corrections only, not for automatic reversal on uncompletion.

### Award Eligibility

Awards are checked after every streak recalculation. The configured milestones are:

```typescript
const STREAK_MILESTONES = [7, 15, 30];
```

For each milestone:
1. If `currentStreak >= milestone` and no existing Award record exists for `(userId, awardType='STREAK', milestone)`, create the Award with `grantedAt = now()`.
2. Awards are never revoked once granted.

---

## Database Constraints

| Constraint | Purpose |
|------------|---------|
| `UNIQUE(userId, date, prayerName)` on PrayerLog | Already exists. Guarantees idempotency. No migration needed. |
| `UNIQUE(userId, awardType, milestone)` on Award | Prevents duplicate awards for the same milestone. |
| `INDEX(userId, date)` on PrayerLog | Already exists. Accelerates daily completeness checks and streak scans. |
| `INDEX(userId, relatedDate)` on PointTransaction | Accelerates points aggregation and history queries. |
| `INDEX(userId, awardType)` on Award | Accelerates award list queries. |
| `ON DELETE CASCADE` on all relations | Already exists. Ensures user deletion cleans up all associated data. |

---

## Migration SQL (Run After `prisma migrate dev`)

### Migrate existing user milestones to Award table

```sql
INSERT INTO "Award" (id, "userId", "awardType", milestone, "grantedAt", "createdAt")
SELECT gen_random_uuid(), um."userId", 'STREAK', m."targetDays", um."achievedAt", um."createdAt"
FROM "UserMilestone" um
JOIN "Milestone" m ON um."milestoneId" = m.id;
```

### Backfill PointTransaction from DailySummary (optional audit trail)

```sql
INSERT INTO "PointTransaction" (id, "userId", points, reason, "relatedDate", "createdAt")
SELECT gen_random_uuid(), "userId", "totalPoints", 'DAILY_COMPLETION', date, "createdAt"
FROM "DailySummary"
WHERE "totalPoints" > 0;
```

---

## Future Cleanup Migration (Post-V1)

After frontend fully migrates to new endpoints and the new tables are verified:

1. Drop `DailySummary` table and `DailySummaryModule`
2. Drop `Milestone` and `UserMilestone` tables and `MilestonesModule`
3. Drop `points` column from `PrayerLog` (fully replaced by PointTransaction ledger)
4. Consider renaming `prayerName` → `prayerType` in code (DB column can keep its name if desired)
5. Consider simplifying `PrayerStatus` enum to `COMPLETED` / `UNCOMPLETED` with a data migration
