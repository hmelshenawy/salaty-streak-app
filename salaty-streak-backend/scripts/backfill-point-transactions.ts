import { PrismaClient, PointReason } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of point transactions from DailySummary...');

  const summaries = await prisma.dailySummary.findMany({
    where: { totalPoints: { gt: 0 } },
  });

  let backfilledCount = 0;
  let skippedCount = 0;

  for (const summary of summaries) {
    try {
      // Create a deterministic unique ID to make this idempotent
      const existing = await prisma.pointTransaction.findFirst({
        where: {
          userId: summary.userId,
          relatedDate: summary.date,
          reason: PointReason.DAILY_COMPLETION,
        },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await prisma.pointTransaction.create({
        data: {
          userId: summary.userId,
          points: summary.totalPoints,
          reason: PointReason.DAILY_COMPLETION,
          relatedDate: summary.date,
          description: 'Backfilled from DailySummary',
        },
      });

      backfilledCount++;
    } catch (err) {
      console.warn(
        `Skipped DailySummary ${summary.id} for user ${summary.userId} on ${summary.date}:`,
        (err as Error).message,
      );
      skippedCount++;
    }
  }

  console.log(
    `Backfill complete. Created: ${backfilledCount}, Already existed (skipped): ${skippedCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
