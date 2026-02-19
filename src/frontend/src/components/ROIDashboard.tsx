import { useEffect, useState } from 'react';
import { useBettingHistory } from '../hooks/useBettingHistory';
import { getOddsBucketStats } from '../lib/storage';
import { subscribeToStorageChanges } from '../lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { OddsBucketStats } from '../types/storage';

export function ROIDashboard() {
  const { bettingHistory, isLoading } = useBettingHistory();
  const [bucketStats, setBucketStats] = useState<OddsBucketStats | null>(null);

  // Load bucket stats and subscribe to changes
  useEffect(() => {
    const loadStats = () => {
      const stats = getOddsBucketStats();
      setBucketStats(stats);
    };

    loadStats();
    const unsubscribe = subscribeToStorageChanges(loadStats);
    return unsubscribe;
  }, []);

  const totalRaces = bettingHistory?.totalRaces || 0;
  const roiPercentage = bettingHistory?.cumulativeROI || 0;
  const winRate = bettingHistory?.winRate || 0;
  const isPositiveROI = roiPercentage > 0;

  const bucketRanges: Array<'1-2' | '3-5' | '6-10' | '11-30'> = ['1-2', '3-5', '6-10', '11-30'];

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

      {/* Odds Bucket Performance */}
      {bucketStats && totalRaces > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Odds Bucket Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bucketRanges.map((range) => {
              const bucket = bucketStats[range];
              const hasData = bucket.totalRaces >= 10;
              const isPositive = bucket.roiIfFlatBet > 0;

              return (
                <div
                  key={range}
                  className={`bg-muted/30 border rounded-lg p-3 ${
                    !hasData ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground">
                        {range}
                      </span>
                      {!hasData && (
                        <Badge variant="outline" className="text-xs">
                          Low Data
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">
                      {bucket.totalRaces} races
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground font-medium">Win Rate</div>
                      <div className="font-black text-foreground">
                        {bucket.actualWinRate.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground font-medium">ROI</div>
                      <div
                        className={`font-black ${
                          isPositive ? 'text-accent' : 'text-destructive'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {bucket.roiIfFlatBet.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {bucket.recentWindowPerformance > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-xs text-muted-foreground">
                        Recent: {bucket.recentWindowPerformance.toFixed(0)}% win rate
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
