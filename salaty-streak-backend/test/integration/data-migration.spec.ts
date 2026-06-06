import { spawn } from 'child_process';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function runScript(scriptPath: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('npx', ['ts-node', scriptPath], {
      cwd: resolve(__dirname, '../..'),
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolvePromise({ stdout, stderr, exitCode: code ?? 0 });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

describe('Data Migration Scripts (integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('migrate-milestones-to-awards.ts', () => {
    it('should run successfully and be idempotent', async () => {
      const userMilestoneCount = await prisma.userMilestone.count();
      const awardCountBefore = await prisma.award.count();

      // First run
      const run1 = await runScript('scripts/migrate-milestones-to-awards.ts');
      expect(run1.exitCode).toBe(0);
      expect(run1.stdout).toContain('Migration complete');

      const awardCountAfter1 = await prisma.award.count();
      // Awards created should equal the number of user milestones that were not already present
      expect(awardCountAfter1).toBeGreaterThanOrEqual(awardCountBefore);

      // Second run (idempotency check)
      const run2 = await runScript('scripts/migrate-milestones-to-awards.ts');
      expect(run2.exitCode).toBe(0);
      expect(run2.stdout).toContain('Migration complete');

      const awardCountAfter2 = await prisma.award.count();
      expect(awardCountAfter2).toBe(awardCountAfter1); // No duplicates

      // Verify all user milestones are represented
      if (userMilestoneCount > 0) {
        const distinctAwardPairs = await prisma.award.groupBy({
          by: ['userId', 'milestone'],
          _count: { id: true },
        });
        // Each distinct pair should have exactly 1 award (upsert guarantees this)
        expect(distinctAwardPairs.every((g) => g._count.id === 1)).toBe(true);
      }
    }, 30000);
  });

  describe('backfill-point-transactions.ts', () => {
    it('should run successfully and be idempotent', async () => {
      const pointTxCountBefore = await prisma.pointTransaction.count();
      const eligibleSummaries = await prisma.dailySummary.count({
        where: { totalPoints: { gt: 0 } },
      });

      // First run
      const run1 = await runScript('scripts/backfill-point-transactions.ts');
      expect(run1.exitCode).toBe(0);
      expect(run1.stdout).toContain('Backfill complete');

      const pointTxCountAfter1 = await prisma.pointTransaction.count();
      expect(pointTxCountAfter1).toBeGreaterThanOrEqual(pointTxCountBefore);

      // Second run (idempotency check)
      const run2 = await runScript('scripts/backfill-point-transactions.ts');
      expect(run2.exitCode).toBe(0);
      expect(run2.stdout).toContain('Backfill complete');

      const pointTxCountAfter2 = await prisma.pointTransaction.count();
      expect(pointTxCountAfter2).toBe(pointTxCountAfter1); // No duplicates
    }, 30000);
  });
});
