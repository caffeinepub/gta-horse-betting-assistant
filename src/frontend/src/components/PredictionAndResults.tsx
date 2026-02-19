import { useState, useEffect } from 'react';
import { useGetValueBets } from '../hooks/useQueries';
import { useRaceStorage } from '../hooks/useRaceStorage';
import { getOddsBucketStats } from '../lib/storage';
import { classifyOddsToBucket } from '../lib/statsCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, AlertCircle, Trophy, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Horse } from '../backend';
import type { HorseWithName } from './OddsEntryForm';
import type { RaceRecordInput, SignalData, ModelWeights, OddsBucketStats } from '../types/storage';
import { cn } from '@/lib/utils';

interface PredictionAndResultsProps {
  horses: HorseWithName[];
  onResultLogged: () => void;
  onReset: () => void;
}

export function PredictionAndResults({ horses, onResultLogged, onReset }: PredictionAndResultsProps) {
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [bucketStats, setBucketStats] = useState<OddsBucketStats | null>(null);
  const { logRaceToStorage, isLogging } = useRaceStorage();

  // Load bucket stats on mount
  useEffect(() => {
    const stats = getOddsBucketStats();
    setBucketStats(stats);
  }, []);

  // Convert to backend Horse type for value bet calculation
  const backendHorses: Horse[] = horses.map((h) => ({
    odds: h.odds,
    predictedProb: 1 / h.odds,
    actualOutcome: false,
  }));

  const { data: valueBets, isLoading } = useGetValueBets(backendHorses);

  // Calculate adjusted probabilities using bucket statistics
  const horsesWithAdjustedProb = horses.map((h) => {
    const impliedProb = 1 / h.odds;
    
    // If we have bucket stats, adjust probability based on bucket performance
    if (bucketStats) {
      const bucketKey = classifyOddsToBucket(h.odds);
      const bucket = bucketStats[bucketKey];
      
      // Use bucket's actualWinRate and roiIfFlatBet to adjust implied probability
      if (bucket.totalRaces > 5) {
        // Adjustment factor based on bucket performance
        const performanceFactor = bucket.actualWinRate / 100;
        const roiFactor = 1 + (bucket.roiIfFlatBet / 100);
        
        // Combine factors to adjust probability
        const adjustmentMultiplier = (performanceFactor + roiFactor) / 2;
        const adjustedProb = impliedProb * adjustmentMultiplier;
        
        return {
          ...h,
          impliedProb,
          adjustedProb: Math.max(0.01, Math.min(0.99, adjustedProb)),
        };
      }
    }
    
    // No adjustment if insufficient data
    return {
      ...h,
      impliedProb,
      adjustedProb: impliedProb,
    };
  });

  // Normalize adjusted probabilities to sum to 1.0
  const totalAdjustedProb = horsesWithAdjustedProb.reduce((sum, h) => sum + h.adjustedProb, 0);
  const normalizedHorses = horsesWithAdjustedProb.map((h) => ({
    ...h,
    normalizedProb: (h.adjustedProb / totalAdjustedProb) * 100,
  }));

  // Sort by normalized probability (highest first)
  const sortedHorses = [...normalizedHorses].sort((a, b) => b.normalizedProb - a.normalizedProb);

  const topPick = sortedHorses[0];
  const hasValueBets = valueBets && valueBets.length > 0;

  // Check if top pick is a value bet by comparing odds
  const topPickIsValueBet = hasValueBets && valueBets.some((v) => Math.abs(v.odds - topPick.odds) < 0.01);

  const handleSelectWinner = (horseName: string) => {
    setSelectedWinner(horseName);
  };

  const handleSubmit = async () => {
    if (!selectedWinner) {
      toast.error('Select the winning horse');
      return;
    }

    // Find winner index and calculate placements
    const winnerIndex = horses.findIndex(h => h.name === selectedWinner);
    
    // Use normalized probabilities for prediction
    const predictedProbs = normalizedHorses.map(h => h.normalizedProb / 100);
    const impliedProbs = horses.map(h => 1 / h.odds);

    // Find recommended contender (highest predicted probability)
    const recommendedContender = predictedProbs.indexOf(Math.max(...predictedProbs));

    // Calculate profit/loss (assuming $1 bet on recommended contender)
    const betSize = 1.0;
    const profitLoss = winnerIndex === recommendedContender 
      ? (horses[recommendedContender].odds * betSize) - betSize
      : -betSize;

    // Create signal breakdown
    const signalBreakdown: SignalData[] = horses.map((_, i) => ({
      contenderIndex: i,
      signalStrength: predictedProbs[i],
      confidence: predictedProbs[i] * 100,
    }));

    // Create model weights snapshot
    const modelWeights: ModelWeights = {
      oddsWeight: 1.0,
      formWeight: 0.5,
      trustWeight: 0.7,
    };

    // For simplicity, assume second and third place are the next highest probabilities
    const sortedIndices = predictedProbs
      .map((prob, idx) => ({ prob, idx }))
      .sort((a, b) => b.prob - a.prob)
      .map(item => item.idx);

    const actualSecond = sortedIndices[1] || 0;
    const actualThird = sortedIndices[2] || 0;

    // Create race record
    const raceRecord: RaceRecordInput = {
      odds: horses.map(h => h.odds),
      impliedProbabilities: impliedProbs,
      strategyMode: 'bucket-adjusted',
      predictedProbabilities: predictedProbs,
      signalBreakdown,
      recommendedContender,
      recommendedBetSize: betSize,
      modelWeightsSnapshot: modelWeights,
      actualFirst: winnerIndex,
      actualSecond,
      actualThird,
      profitLoss,
    };

    try {
      // Log to AsyncStorage (triggers bucket stats recalculation)
      await logRaceToStorage(raceRecord);
      
      toast.success('Race logged successfully!');
      onResultLogged();
    } catch (error) {
      console.error('Failed to log race:', error);
      toast.error('Failed to log race result');
    }
  };

  return (
    <div className="space-y-6">
      {/* Prediction Section */}
      <Card className="border-2 border-accent bg-accent/5">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Recommended Pick
          </CardTitle>
          <CardDescription>
            Based on {bucketStats ? 'bucket-adjusted' : 'implied'} probabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="bg-card border-2 border-accent rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-2xl font-black text-foreground">{topPick.name}</div>
                    <div className="text-sm text-muted-foreground font-medium">
                      Odds: {topPick.odds.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-accent">
                      {topPick.normalizedProb.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground font-medium uppercase">
                      Win Probability
                    </div>
                  </div>
                </div>
                {topPickIsValueBet && (
                  <Badge variant="default" className="mt-2">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Value Bet
                  </Badge>
                )}
              </div>

              {hasValueBets && valueBets.length > 1 && (
                <div className="bg-muted/50 border border-border rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <span className="font-bold">{valueBets.length} value bets</span> detected in this race
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Horses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase">All Horses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedHorses.map((horse, index) => (
              <div
                key={horse.name}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg font-black text-muted-foreground w-6">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-bold text-foreground">{horse.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Odds: {horse.odds.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-foreground">
                    {horse.normalizedProb.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Result Logger */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase">Log Result</CardTitle>
          <CardDescription>Select the winning horse</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {horses.map((horse) => (
              <Button
                key={horse.name}
                variant={selectedWinner === horse.name ? 'default' : 'outline'}
                className={cn(
                  'justify-start h-auto py-3 font-bold',
                  selectedWinner === horse.name && 'border-2 border-accent'
                )}
                onClick={() => handleSelectWinner(horse.name)}
              >
                <Trophy className="h-4 w-4 mr-2" />
                {horse.name}
              </Button>
            ))}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!selectedWinner || isLogging}
            className="w-full font-black uppercase"
            size="lg"
          >
            {isLogging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Logging...
              </>
            ) : (
              'Submit Result'
            )}
          </Button>

          <Button
            onClick={onReset}
            variant="outline"
            className="w-full font-bold"
            disabled={isLogging}
          >
            Start New Race
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
