import { useState, useEffect } from 'react';
import { useGetValueBets } from '../hooks/useQueries';
import { useRaceStorage } from '../hooks/useRaceStorage';
import { getOddsBucketStats, readModelState } from '../lib/storage';
import { 
  calculateBucketAdjustedProbabilities, 
  calculateValueEdge,
  calculateConfidence,
  getStrategyRecommendation,
  calculateBetSize,
  calculateSignalBreakdownForContender,
  identifyHotAndTrapBuckets,
  type SignalBreakdown,
} from '../lib/statsCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, AlertCircle, Trophy, DollarSign, Minus, Plus, Flame, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import type { Horse } from '../backend';
import type { OddsOnlyData } from './OddsEntryForm';
import type { RaceRecordInput, SignalData, ModelWeights, OddsBucketStats, ModelState } from '../types/storage';
import { cn } from '@/lib/utils';

interface PredictionAndResultsProps {
  raceData: OddsOnlyData;
  onResultLogged: () => void;
  onReset: () => void;
}

interface ContenderWithProb {
  index: number;
  label: string;
  odds: number;
  impliedProb: number;
  adjustedProb: number;
  normalizedProb: number;
  valueEdge: number;
}

export function PredictionAndResults({ raceData, onResultLogged, onReset }: PredictionAndResultsProps) {
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [bucketStats, setBucketStats] = useState<OddsBucketStats | null>(null);
  const [modelState, setModelState] = useState<ModelState | null>(null);
  const [userBetSize, setUserBetSize] = useState<number | null>(null);
  const [showBucketInfo, setShowBucketInfo] = useState(false);
  const { logRaceToStorage, isLogging } = useRaceStorage();

  // Load bucket stats and model state on mount
  useEffect(() => {
    const stats = getOddsBucketStats();
    setBucketStats(stats);
    
    const state = readModelState();
    setModelState(state);
  }, []);

  // Convert to backend Horse type for value bet calculation
  const backendHorses: Horse[] = raceData.odds.map((odds) => ({
    odds,
    predictedProb: 1 / odds,
    actualOutcome: false,
  }));

  const { data: valueBets, isLoading } = useGetValueBets(backendHorses);

  // Calculate implied probabilities
  const impliedProbabilities = raceData.odds.map(o => 1 / o);

  // Calculate adjusted probabilities using the five-step prediction engine
  const contenders: ContenderWithProb[] = raceData.odds.map((odds, index) => {
    const impliedProb = impliedProbabilities[index];
    return {
      index,
      label: `#${index + 1}`,
      odds,
      impliedProb,
      adjustedProb: impliedProb,
      normalizedProb: impliedProb,
      valueEdge: 0,
    };
  });

  // Apply bucket-adjusted probabilities if we have bucket stats and model state
  let adjustedProbs: number[] = impliedProbabilities;
  let valueEdge: number[] = new Array(6).fill(0);
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  let recommendedBetSize = 1000;

  if (bucketStats && modelState) {
    adjustedProbs = calculateBucketAdjustedProbabilities(
      raceData.odds,
      bucketStats,
      modelState.signalWeights
    );
    
    valueEdge = calculateValueEdge(adjustedProbs, impliedProbabilities);
    confidenceLevel = calculateConfidence(raceData.odds, bucketStats, modelState);
    
    adjustedProbs.forEach((prob, index) => {
      contenders[index].adjustedProb = prob;
      contenders[index].normalizedProb = prob;
      contenders[index].valueEdge = valueEdge[index];
    });
  }

  // Get strategy recommendation
  const recommendation = getStrategyRecommendation(
    raceData.strategyMode,
    raceData.odds,
    adjustedProbs,
    valueEdge
  );

  // If should skip, show skip message
  if (recommendation.shouldSkip) {
    return (
      <div className="space-y-6">
        <Alert className="border-destructive/50 bg-destructive/5">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <AlertDescription className="text-base font-semibold">
            <div className="text-lg font-bold mb-2">SKIP THIS RACE</div>
            <div>{recommendation.reason}</div>
            <div className="mt-4">
              <Button onClick={onReset} variant="outline">
                Enter New Race
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Recommended pick from strategy
  const recommendedPick = contenders[recommendation.recommendedIndex];

  // Calculate signal breakdown for recommended pick
  let signalBreakdown: SignalBreakdown | null = null;
  if (bucketStats && modelState) {
    signalBreakdown = calculateSignalBreakdownForContender(
      recommendedPick.index,
      raceData.odds,
      bucketStats,
      modelState.signalWeights
    );
  }

  // Calculate recommended bet size
  if (bucketStats && modelState) {
    recommendedBetSize = calculateBetSize(
      recommendedPick.valueEdge,
      confidenceLevel,
      modelState
    );
  }

  // Use user override if set, otherwise use recommended
  const effectiveBetSize = userBetSize ?? recommendedBetSize;

  // Identify hot and trap buckets
  const { hotBucket, trapBucket } = bucketStats ? identifyHotAndTrapBuckets(bucketStats) : { hotBucket: null, trapBucket: null };

  const handleBetSizeAdjust = (delta: number) => {
    const current = userBetSize ?? recommendedBetSize;
    const newSize = Math.max(1000, Math.min(10000, current + delta));
    setUserBetSize(newSize);
  };

  const handleLogResult = async (winnerIndex: number) => {
    setSelectedWinner(winnerIndex);

    // Calculate profit/loss
    const wonBet = winnerIndex === recommendedPick.index;
    const profitLoss = wonBet ? (recommendedPick.odds * effectiveBetSize) - effectiveBetSize : -effectiveBetSize;

    // Create signal breakdown
    const signalBreakdownData: SignalData[] = contenders.map((c) => ({
      contenderIndex: c.index,
      signalStrength: c.normalizedProb,
      confidence: c.normalizedProb * 100,
    }));

    // Create model weights snapshot
    const modelWeightsSnapshot: ModelWeights = {
      oddsWeight: modelState?.signalWeights.oddsWeight ?? 0.4,
      formWeight: 0.3,
      trustWeight: 0.3,
    };

    // Create race record input
    const raceInput: RaceRecordInput = {
      odds: raceData.odds,
      impliedProbabilities: contenders.map((c) => c.impliedProb),
      strategyMode: raceData.strategyMode,
      predictedProbabilities: contenders.map((c) => c.normalizedProb),
      valueEdge: valueEdge,
      confidenceLevel: confidenceLevel,
      signalBreakdown: signalBreakdownData,
      recommendedContender: recommendedPick.index,
      recommendedBetSize: effectiveBetSize,
      modelWeightsSnapshot,
      actualFirst: winnerIndex,
      actualSecond: -1,
      actualThird: -1,
      profitLoss,
    };

    try {
      await logRaceToStorage(raceInput);
      toast.success(wonBet ? '🎉 Winner! Race logged successfully' : 'Race logged successfully');
      onResultLogged();
    } catch (error) {
      console.error('Failed to log race:', error);
      toast.error('Failed to log race result');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const confidenceColor = {
    high: 'text-accent',
    medium: 'text-yellow-500',
    low: 'text-orange-500',
  }[confidenceLevel];

  const confidenceBgColor = {
    high: 'bg-accent/10 border-accent/30',
    medium: 'bg-yellow-500/10 border-yellow-500/30',
    low: 'bg-orange-500/10 border-orange-500/30',
  }[confidenceLevel];

  return (
    <div className="space-y-6">
      {/* HEADER SECTION: Strategy Mode + All Odds with Implied Probabilities */}
      <Card className="border-2 border-accent/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Race Overview</CardTitle>
            <Badge variant="default" className="text-base font-bold px-4 py-1 bg-accent">
              {raceData.strategyMode} Strategy
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {contenders.map((contender) => (
              <div
                key={contender.index}
                className="flex items-center justify-between rounded-md border bg-card p-3"
              >
                <div className="font-bold text-base">{contender.label}</div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Odds</div>
                    <div className="font-semibold text-base">{contender.odds.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Implied Prob</div>
                    <div className="font-semibold text-base">{(contender.impliedProb * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PRIMARY PANEL: Best Bet Details */}
      <Card className="border-2 border-accent bg-gradient-to-br from-background to-accent/5">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-accent" />
              <div>
                <CardTitle className="text-2xl">BEST BET: {recommendedPick.label}</CardTitle>
                <CardDescription className="text-base">Recommended pick based on {raceData.strategyMode} strategy</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={cn('text-base font-bold uppercase px-4 py-2', confidenceColor)}>
              {confidenceLevel} Confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-4">
              <div className="text-sm text-muted-foreground mb-1">Predicted Probability</div>
              <div className="text-3xl font-black text-accent">{(recommendedPick.normalizedProb * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground mb-1">Implied Probability</div>
              <div className="text-3xl font-black">{(recommendedPick.impliedProb * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground mb-1">Value Edge</div>
              <div className={cn(
                'text-3xl font-black',
                recommendedPick.valueEdge > 0 ? 'text-accent' : 'text-muted-foreground'
              )}>
                {recommendedPick.valueEdge > 0 ? '+' : ''}
                {(recommendedPick.valueEdge * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground mb-1">Odds</div>
              <div className="text-3xl font-black">{recommendedPick.odds.toFixed(2)}</div>
            </div>
          </div>

          {/* Bet Sizing */}
          <Card className={cn('border-2', confidenceBgColor)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Recommended Bet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  System Recommended:
                </span>
                <span className="text-lg font-bold">
                  ${recommendedBetSize.toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleBetSizeAdjust(-1000)}
                  disabled={effectiveBetSize <= 1000}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <div className="text-sm text-muted-foreground">Your Bet Amount</div>
                  <div className="text-4xl font-black text-accent">
                    ${effectiveBetSize.toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleBetSizeAdjust(1000)}
                  disabled={effectiveBetSize >= 10000}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {userBetSize !== null && userBetSize !== recommendedBetSize && (
                <div className="text-xs text-center text-muted-foreground">
                  Override active (${Math.abs(userBetSize - recommendedBetSize).toLocaleString()} {userBetSize > recommendedBetSize ? 'above' : 'below'} recommendation)
                </div>
              )}
            </CardContent>
          </Card>

          {recommendedPick.valueEdge > 0.02 && (
            <Alert className="border-accent/50 bg-accent/5">
              <TrendingUp className="h-4 w-4 text-accent" />
              <AlertDescription>
                <span className="font-semibold">Value Bet Detected!</span> This pick shows positive expected value
                based on historical bucket performance.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* SECONDARY PANEL: Signal Breakdown */}
      {signalBreakdown && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Signal Breakdown</CardTitle>
            <CardDescription>Individual signal contributions to the prediction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-muted-foreground">Odds Signal</div>
                  <Badge variant="outline">Baseline</Badge>
                </div>
                <div className="text-2xl font-bold">{(signalBreakdown.oddsSignal * 100).toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground mt-1">Implied probability from odds (1/odds)</div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-muted-foreground">Historical Bucket Signal</div>
                  <Badge variant="outline">Adjustment</Badge>
                </div>
                <div className={cn(
                  'text-2xl font-bold',
                  signalBreakdown.historicalBucketSignal > 0 ? 'text-accent' : signalBreakdown.historicalBucketSignal < 0 ? 'text-destructive' : ''
                )}>
                  {signalBreakdown.historicalBucketSignal > 0 ? '+' : ''}
                  {(signalBreakdown.historicalBucketSignal * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Bucket Win Delta adjustment</div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-muted-foreground">Recent Bucket Signal</div>
                  <Badge variant="outline">Adjustment</Badge>
                </div>
                <div className={cn(
                  'text-2xl font-bold',
                  signalBreakdown.recentBucketSignal > 0 ? 'text-accent' : signalBreakdown.recentBucketSignal < 0 ? 'text-destructive' : ''
                )}>
                  {signalBreakdown.recentBucketSignal > 0 ? '+' : ''}
                  {(signalBreakdown.recentBucketSignal * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Recent session performance delta</div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-muted-foreground">Consistency Signal</div>
                  <Badge variant="outline">Adjustment</Badge>
                </div>
                <div className={cn(
                  'text-2xl font-bold',
                  signalBreakdown.consistencySignal > 0 ? 'text-accent' : signalBreakdown.consistencySignal < 0 ? 'text-destructive' : ''
                )}>
                  {signalBreakdown.consistencySignal > 0 ? '+' : ''}
                  {(signalBreakdown.consistencySignal * 100).toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Variance-based consistency modifier</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OPTIONAL: Hot & Trap Odds Buckets */}
      {(hotBucket || trapBucket) && (
        <Collapsible open={showBucketInfo} onOpenChange={setShowBucketInfo}>
          <Card className="border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Bucket Performance Indicators</CardTitle>
                  <Button variant="ghost" size="sm">
                    {showBucketInfo ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotBucket && bucketStats && (
                    <div className="rounded-lg border-2 border-accent/30 bg-accent/5 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Flame className="h-5 w-5 text-accent" />
                        <div className="font-bold text-lg">Hot Odds Bucket</div>
                      </div>
                      <div className="text-3xl font-black text-accent mb-2">{hotBucket}</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recent Performance:</span>
                          <span className="font-semibold">{bucketStats[hotBucket].recentWindowPerformance.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Win Rate:</span>
                          <span className="font-semibold">{bucketStats[hotBucket].actualWinRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sample Size:</span>
                          <span className="font-semibold">{bucketStats[hotBucket].totalRaces} races</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {trapBucket && bucketStats && (
                    <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div className="font-bold text-lg">Trap Odds Bucket</div>
                      </div>
                      <div className="text-3xl font-black text-destructive mb-2">{trapBucket}</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recent Performance:</span>
                          <span className="font-semibold">{bucketStats[trapBucket].recentWindowPerformance.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Variance:</span>
                          <span className="font-semibold">{bucketStats[trapBucket].varianceScore.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sample Size:</span>
                          <span className="font-semibold">{bucketStats[trapBucket].totalRaces} races</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Separator className="my-6" />

      {/* Result Logger */}
      <Card>
        <CardHeader>
          <CardTitle>Log Race Result</CardTitle>
          <CardDescription>Select the winning contender to record the outcome</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedWinner === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {contenders.map((contender) => (
                <Button
                  key={contender.index}
                  variant={contender.index === recommendedPick.index ? 'default' : 'outline'}
                  className={cn(
                    'h-auto flex-col gap-1 py-4',
                    contender.index === recommendedPick.index && 'bg-accent hover:bg-accent/90'
                  )}
                  onClick={() => handleLogResult(contender.index)}
                  disabled={isLogging}
                >
                  <div className="text-xl font-bold">{contender.label}</div>
                  <div className="text-xs opacity-70">Odds: {contender.odds.toFixed(2)}</div>
                </Button>
              ))}
            </div>
          ) : (
            <Alert className="border-accent/50 bg-accent/5">
              <AlertCircle className="h-4 w-4 text-accent" />
              <AlertDescription>
                Result logged! Winner: <span className="font-bold">#{selectedWinner + 1}</span>
              </AlertDescription>
            </Alert>
          )}

          {selectedWinner !== null && (
            <div className="mt-4 flex gap-2">
              <Button onClick={onReset} className="flex-1">
                Enter New Race
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
