import { useState } from 'react';
import { useGetValueBets } from '../hooks/useQueries';
import { useRaceStorage } from '../hooks/useRaceStorage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, AlertCircle, Trophy, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Horse } from '../backend';
import type { HorseWithName } from './OddsEntryForm';
import type { RaceRecordInput, SignalData, ModelWeights } from '../types/storage';
import { cn } from '@/lib/utils';

interface PredictionAndResultsProps {
  horses: HorseWithName[];
  onResultLogged: () => void;
  onReset: () => void;
}

export function PredictionAndResults({ horses, onResultLogged, onReset }: PredictionAndResultsProps) {
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const { logRaceToStorage, isLogging } = useRaceStorage();

  // Convert to backend Horse type for value bet calculation
  const backendHorses: Horse[] = horses.map((h) => ({
    odds: h.odds,
    predictedProb: 1 / h.odds,
    actualOutcome: false,
  }));

  const { data: valueBets, isLoading } = useGetValueBets(backendHorses);

  // Calculate implied probabilities
  const horsesWithProb = horses.map((h) => ({
    ...h,
    impliedProb: 1 / h.odds,
  }));

  // Normalize probabilities
  const totalImpliedProb = horsesWithProb.reduce((sum, h) => sum + h.impliedProb, 0);
  const normalizedHorses = horsesWithProb.map((h) => ({
    ...h,
    normalizedProb: (h.impliedProb / totalImpliedProb) * 100,
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
    
    // Calculate predicted probabilities
    const totalImplied = horses.reduce((sum, horse) => sum + 1 / horse.odds, 0);
    const predictedProbs = horses.map(h => (1 / h.odds) / totalImplied);
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
      strategyMode: 'odds-anchored',
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
      // Log to AsyncStorage
      await logRaceToStorage(raceRecord);
      
      toast.success('Race logged! Performance stats updated.');
      onResultLogged();
    } catch (error) {
      toast.error('Failed to log race result');
      console.error('Race logging error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Prediction Section */}
      <div className="space-y-4">
        <Card className="border-2 border-accent bg-accent/5">
          <CardHeader>
            <CardTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-accent" />
              Recommended Pick
            </CardTitle>
            <CardDescription className="text-base">
              Based on odds-anchored probability analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-card border-2 border-accent rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-3xl font-black uppercase text-accent">{topPick.name}</h3>
                    <Badge variant="default" className="text-lg px-4 py-1 font-bold">
                      {topPick.odds.toFixed(2)}:1
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground font-semibold">
                      Win Probability: <span className="text-foreground font-bold">{topPick.normalizedProb.toFixed(1)}%</span>
                    </span>
                    {topPickIsValueBet && (
                      <Badge variant="secondary" className="font-bold">
                        VALUE BET
                      </Badge>
                    )}
                  </div>
                </div>

                {!hasValueBets && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="font-medium">
                      No value bets detected. The odds accurately reflect probabilities. Consider betting on the favorite or skipping this race.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl font-bold uppercase">All Horses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedHorses.map((horse) => (
                <div
                  key={horse.name}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground">{horse.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground font-semibold">
                      {horse.normalizedProb.toFixed(1)}%
                    </span>
                    <Badge variant="outline" className="font-bold">
                      {horse.odds.toFixed(2)}:1
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* Result Logging Section */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-2xl font-black uppercase flex items-center gap-2">
            <Trophy className="h-6 w-6 text-accent" />
            Log Race Result
          </CardTitle>
          <CardDescription className="text-base">
            Select the winning horse to update the learning system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {horses.map((horse) => (
              <button
                key={horse.name}
                onClick={() => handleSelectWinner(horse.name)}
                disabled={isLogging}
                className={cn(
                  'p-4 rounded-lg border-2 text-left transition-all font-bold text-lg',
                  'hover:border-accent hover:bg-accent/10',
                  selectedWinner === horse.name
                    ? 'border-accent bg-accent/20 scale-105'
                    : 'border-border bg-card'
                )}
              >
                <div className="flex items-center justify-between">
                  <span>{horse.name}</span>
                  <span className="text-sm text-muted-foreground font-semibold">
                    {horse.odds.toFixed(2)}:1
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onReset}
              disabled={isLogging}
              className="flex-1 font-bold"
            >
              Start Over
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedWinner || isLogging}
              className="flex-1 font-bold text-base"
              size="lg"
            >
              {isLogging ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Logging...
                </>
              ) : (
                'Confirm Winner'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
