'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { StreakCalendar } from '@/components/streaks/StreakCalendar';
import { NextMilestoneCard } from '@/components/streaks/NextMilestoneCard';
import { MilestoneList } from '@/components/streaks/MilestoneList';
import { Flame, Trophy } from 'lucide-react';

export default function StreaksPage() {
  const { data, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Streaks</h1>

      {/* Streak summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card ring-1 ring-foreground/5 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
            <Flame className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <div className="text-3xl font-bold">{data.currentStreak}</div>
            <p className="text-xs text-muted-foreground">current day{data.currentStreak !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-card ring-1 ring-foreground/5 flex-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
            <Trophy className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <div className="text-3xl font-bold">{data.bestStreak}</div>
            <p className="text-xs text-muted-foreground">personal best</p>
          </div>
        </div>
      </div>

      {/* Next milestone — prefer new awards data if available, fall back to legacy */}
      {data.awards?.nextTarget ? (
        <NextMilestoneCard
          nextMilestone={{
            title: data.awards.nextTarget.title,
            targetDays: data.awards.nextTarget.milestone,
            remainingDays: data.awards.nextTarget.remainingDays,
          }}
        />
      ) : (
        <NextMilestoneCard nextMilestone={data.nextMilestone} />
      )}

      {/* Calendar */}
      <StreakCalendar />

      {/* Awards section — shown when backend sends awards (flags ON) */}
      {data.awards && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Awards</h2>
          {data.awards.earned.length === 0 && data.awards.locked.length === 0 && (
            <p className="text-sm text-muted-foreground">No awards yet. Keep praying to earn milestones! 🌟</p>
          )}
          <div className="space-y-3">
            {data.awards.earned.map((award) => (
              <div
                key={award.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-card ring-1 ring-primary/20"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary text-lg">
                  {award.icon ?? '🏆'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{award.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {award.milestone}-Day Streak · Earned{' '}
                    {new Date(award.grantedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {data.awards.locked.map((locked) => (
              <div
                key={locked.milestone}
                className="flex items-center gap-3 p-4 rounded-xl bg-card ring-1 ring-foreground/5 opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground text-lg">
                  🔒
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{locked.title}</p>
                  <div className="mt-1.5">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.max((locked.progress / locked.target) * 100, 2)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {locked.target - locked.progress > 0
                        ? `${locked.target - locked.progress} day${locked.target - locked.progress !== 1 ? 's' : ''} to go`
                        : 'Almost there!'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy milestones — kept when awards are not yet available (flags OFF) */}
      {!data.awards && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Milestones</h2>
          <MilestoneList />
        </div>
      )}
    </div>
  );
}
