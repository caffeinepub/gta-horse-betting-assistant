import { useGetValueBets } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Horse } from '../backend';
import type { HorseWithName } from './OddsEntryForm';

interface PredictionDisplayProps {
  horses: HorseWithName[];
  onContinue: () => void;
  onReset: () => void;
}

export function PredictionDisplay({ horses, onContinue, onReset }: PredictionDisplayProps) {
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

  return (
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

      <div className="flex gap-2">
        <Button variant="outline" onClick={onReset} className="flex-1 font-bold">
          Start Over
        </Button>
        <Button onClick={onContinue} className="flex-1 font-bold text-base" size="lg">
          Log Race Result
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
