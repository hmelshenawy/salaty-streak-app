export interface EarnedAward {
  id: string;
  awardType: 'STREAK_MILESTONE';
  milestone: number;
  title: string;
  description: string | null;
  icon: string | null;
  grantedAt: string;
}

export interface LockedAward {
  awardType: 'STREAK_MILESTONE';
  milestone: number;
  title: string;
  description: string | null;
  progress: number;
  target: number;
}

export interface NextAwardTarget {
  milestone: number;
  title: string;
  remainingDays: number;
}

export interface AwardsSummary {
  earned: EarnedAward[];
  locked: LockedAward[];
  nextTarget: NextAwardTarget | null;
}
