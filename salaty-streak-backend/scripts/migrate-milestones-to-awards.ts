import { PrismaClient, AwardType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting milestone-to-award migration...');

  const userMilestones = await prisma.userMilestone.findMany({
    include: { milestone: true },
  });

  let migratedCount = 0;
  let skippedCount = 0;

  for (const um of userMilestones) {
    try {
      await prisma.award.upsert({
        where: {
          userId_awardType_milestone: {
            userId: um.userId,
            awardType: AwardType.STREAK_MILESTONE,
            milestone: um.milestone.targetDays,
          },
        },
        create: {
          userId: um.userId,
          awardType: AwardType.STREAK_MILESTONE,
          milestone: um.milestone.targetDays,
          title: um.milestone.title,
          description: um.milestone.description,
          icon: um.milestone.icon,
          grantedAt: um.achievedAt,
        },
        update: {}, // No changes if already exists
      });
      migratedCount++;
    } catch (err) {
      console.warn(`Skipped UserMilestone ${um.id}:`, (err as Error).message);
      skippedCount++;
    }
  }

  console.log(`Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
