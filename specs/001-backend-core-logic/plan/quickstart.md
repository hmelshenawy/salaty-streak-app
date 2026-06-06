# Quickstart: Move Core Logic to Backend

**Input**: Implementation plan from `specs/001-backend-core-logic/plan/`

**Context**: This is an incremental update to an existing running app. The backend already exists at `salaty-streak-backend/`.

## Prerequisites

- Node.js 20 LTS (already used by existing project)
- PostgreSQL 15+ (already configured)
- Git

## Setup

### 1. Install New Dependencies

```bash
cd salaty-streak-backend
npm install
```

No new runtime dependencies are required for V1. The existing stack already includes:
- NestJS, Prisma, class-validator, date-fns, date-fns-tz

If any are missing:
```bash
npm install date-fns-tz
npm install -D @types/node supertest @types/supertest
```

### 2. Configure Environment

The existing `.env` at `salaty-streak-backend/.env` should already have:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/salaty_streak?schema=public"
JWT_SECRET="your-jwt-secret-here"
PORT=3100
```

Verify it exists and is correct. No changes needed unless adding new env vars.

### 3. Run Prisma Migration

```bash
cd salaty-streak-backend
npx prisma migrate dev --name add_point_transaction_and_award
npx prisma generate
```

This adds the `PointTransaction` and `Award` tables without touching existing tables.

### 4. Run Data Migration (One-Time)

After the schema migration succeeds, run the data migration script to copy existing user milestones into the Award table:

```bash
npx ts-node scripts/migrate-milestones-to-awards.ts
```

(Optional) Backfill PointTransaction from DailySummary:
```bash
npx ts-node scripts/backfill-point-transactions.ts
```

> **Note**: These scripts should be idempotent and written as part of the implementation tasks.

### 5. Start Development Server

```bash
npm run start:dev
```

Backend runs at `http://localhost:3100` (existing port).

### 6. Verify Setup

```bash
curl http://localhost:3100/dashboard \
  -H "Authorization: Bearer <your-jwt-token>"
```

Expected: Dashboard response with new fields alongside existing fields.

## Running Tests

```bash
# Unit tests (existing suite)
npm run test

# E2E tests (existing suite)
npm run test:e2e

# New contract/integration tests (to be added)
npm run test -- --testPathPattern="contract|integration"
```

## API Quick Reference

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/dashboard` | GET | Full home-screen state | **MODIFIED** — updated shape |
| `/prayers/:prayerType/complete` | POST | Mark prayer complete | **NEW** |
| `/prayers/:prayerType/uncomplete` | POST | Unmark prayer | **NEW** |
| `/prayers` | POST | Create full prayer log | **EXISTING** — kept during transition |
| `/prayers/today` | GET | Today's prayer logs | **EXISTING** — no change |
| `/prayers/history` | GET | Monthly history | **EXISTING** — no change |
| `/streaks/current` | GET | Current + longest streak | **MODIFIED** — derives from PrayerLog now |
| `/points/summary` | GET | Total points + breakdown | **NEW** |
| `/awards` | GET | Earned + locked awards | **NEW** |
| `/streaks/milestones` | GET | All milestones | **EXISTING** — reads both old and new tables |

All endpoints require `Authorization: Bearer <jwt>` header.

## Common Tasks

### View Database

```bash
npx prisma studio
```

### Format Schema

```bash
npx prisma format
```

### Verify Data Migration

```sql
-- Compare migrated awards vs original milestones
SELECT u.email, a.milestone, a."grantedAt"
FROM "Award" a
JOIN "User" u ON a."userId" = u.id
ORDER BY u.email, a.milestone;
```
