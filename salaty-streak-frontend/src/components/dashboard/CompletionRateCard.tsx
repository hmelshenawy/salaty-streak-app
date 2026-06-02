'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface CompletionRateCardProps {
  completionRate: number;
}

export function CompletionRateCard({ completionRate }: CompletionRateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Completion Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Target className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <div className="text-3xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">this month</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}