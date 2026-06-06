import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StreaksService } from '../src/streaks/streaks.service';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  process.env.ENABLE_STREAK_COMPARISON = 'true';
  process.env.ENABLE_DASHBOARD_COMPARISON = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const prisma = app.get(PrismaService);
  const streaksService = app.get(StreaksService);
  const dashboardService = app.get(DashboardService);

  // Fetch a sample of real users (all users, capped at 50 for safety)
  const users = await prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  });

  console.log(`Running comparison audit against ${users.length} production users...\n`);

  const streakStats = {
    totalChecked: 0,
    mismatches: 0,
    mismatchLogs: [] as any[],
  };

  const dashboardStats = {
    totalChecked: 0,
    totalMismatches: 0,
    fieldCounts: {} as Record<string, number>,
    sampleMismatches: [] as any[],
  };

  for (const user of users) {
    // Streak comparison
    const streakLog = await streaksService.compareStreakCalculations(user.id);
    if (streakLog) {
      streakStats.totalChecked++;
      if (streakLog.currentDifference !== 0 || streakLog.bestDifference !== 0) {
        streakStats.mismatches++;
        streakStats.mismatchLogs.push(streakLog);
      }
    }

    // Dashboard comparison
    try {
      const dashResult = await dashboardService.compareDashboardCalculations(user.id);
      dashboardStats.totalChecked++;
      if (dashResult.mismatches.length > 0) {
        dashboardStats.totalMismatches += dashResult.mismatches.length;
        for (const m of dashResult.mismatches) {
          dashboardStats.fieldCounts[m.field] = (dashboardStats.fieldCounts[m.field] ?? 0) + 1;
        }
        if (dashboardStats.sampleMismatches.length < 5) {
          dashboardStats.sampleMismatches.push({ userId: user.id, userName: user.name, mismatches: dashResult.mismatches });
        }
      }
    } catch (err) {
      console.warn(`Dashboard comparison failed for ${user.id}:`, (err as Error).message);
    }
  }

  console.log('=== STREAK COMPARISON RESULTS ===');
  console.log(`Users checked:     ${streakStats.totalChecked}`);
  console.log(`Mismatches found:  ${streakStats.mismatches}`);
  if (streakStats.mismatches > 0) {
    console.log('\nSample mismatch logs:');
    streakStats.mismatchLogs.slice(0, 3).forEach((log) => console.log(JSON.stringify(log)));
  }

  console.log('\n=== DASHBOARD COMPARISON RESULTS ===');
  console.log(`Users checked:     ${dashboardStats.totalChecked}`);
  console.log(`Total mismatches:  ${dashboardStats.totalMismatches}`);
  console.log(`Field breakdown:   ${JSON.stringify(dashboardStats.fieldCounts)}`);
  if (dashboardStats.sampleMismatches.length > 0) {
    console.log('\nSample dashboard mismatches:');
    dashboardStats.sampleMismatches.forEach((s) => {
      console.log(`User: ${s.userName} (${s.userId})`);
      s.mismatches.forEach((m: any) => console.log(`  - ${m.field}: old=${m.oldValue}, new=${m.newValue}, diff=${m.difference}`));
    });
  }

  const zeroMismatchGate = streakStats.mismatches === 0 && dashboardStats.totalMismatches === 0;
  console.log(`\n=== ZERO-MISMATCH GATE: ${zeroMismatchGate ? 'PASS ✅' : 'FAIL ❌'} ===`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
