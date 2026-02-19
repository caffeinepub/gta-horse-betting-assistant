import { useBettingHistory } from '../hooks/useBettingHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ROIDashboard() {
  const { bettingHistory, isLoading } = useBettingHistory();

  const totalRaces = bettingHistory?.totalRaces || 0;
  const roiPercentage = bettingHistory?.cumulativeROI || 0;
  const winRate = bettingHistory?.winRate || 0;
  const isPositiveROI = roiPercentage > 0;

  return (
    <div className="space-y-4 sticky top-4">
      <Card className="border-2 border-accent bg-accent/5">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase">Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="bg-card border-2 border-accent rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase text-muted-foreground">ROI</span>
                {isPositiveROI ? (
                  <TrendingUp className="h-5 w-5 text-accent" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div className={`text-4xl font-black ${isPositiveROI ? 'text-accent' : 'text-destructive'}`}>
                {roiPercentage >= 0 ? '+' : ''}
                {roiPercentage.toFixed(1)}%
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase text-muted-foreground">Races</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="text-2xl font-black text-foreground">{totalRaces}</div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase text-muted-foreground">Win Rate</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="text-2xl font-black text-foreground">{winRate.toFixed(0)}%</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {totalRaces === 0 && !isLoading && (
        <Card className="border-2">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center font-medium">
              No races logged yet. Start by entering odds for your first race!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
