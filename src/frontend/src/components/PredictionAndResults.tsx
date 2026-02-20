import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Trophy, TrendingUp, TrendingDown, DollarSign, Target, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { useRaceStorage } from '../hooks/useRaceStorage';
import { getModelState, getOddsBucketStats } from '../lib/storage';
import { updateSignalWeights } from '../lib/statsCalculator';
import type { OddsOnlyData, StrategyMode, RaceRecordInput } from '@/types/storage';
import { toast } from 'sonner';

interface PredictionAndResultsProps {
  oddsData: OddsOnlyData;
  strategyMode: StrategyMode;
  onComplete: () => void;
}

interface Contender {
  index: number;
  odds: number;
  impliedProbability: number;
  adjustedProbability: number;
  valueEdge: number;
}

export function PredictionAndResults({ oddsData, strategyMode, onComplete }: PredictionAndResultsProps) {
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [selectedSecond, setSelectedSecond] = useState<number | null>(null);
  const [selectedThird, setSelectedThird] = useState<number | null>(null);
  const { logRaceToStorage, isLogging } = useRaceStorage();

  /**
   * Calculate implied probability using correct fractional odds formula
   * For odds X/1: Implied Probability = 1 / (X + 1)
   */
  const calculateImpliedProbability = (odds: number): number => {
    return 1 / (odds + 1);
  };

  // Calculate implied probabilities for all contenders
  const impliedProbabilities = oddsData.odds.map(calculateImpliedProbability);

  // Get model state and bucket stats
  const modelState = getModelState();
  const bucketStats = getOddsBucketStats();

  /**
   * Five-step prediction engine
   * Step 1: Calculate baseline implied probabilities using 1/(odds+1)
   * Step 2-5: Apply bucket adjustments and signal weights
   */
  const calculatePredictions = (): Contender[] => {
    const contenders: Contender[] = oddsData.odds.map((odds, index) => {
      // Step 1: Baseline implied probability (CORRECT FORMULA)
      const impliedProb = calculateImpliedProbability(odds);

      // Step 2: Classify into bucket
      const bucketKey = 
        odds >= 1 && odds <= 2 ? '1-2' :
        odds > 2 && odds <= 5 ? '3-5' :
        odds > 5 && odds <= 10 ? '6-10' :
        '11-30';

      const bucket = bucketStats[bucketKey];

      // Step 3: Calculate bucket adjustment
      let bucketAdjustment = 0;
      if (bucket.totalRaces >= 10) {
        // Use actual win rate vs implied probability delta
        const winRateDecimal = bucket.actualWinRate / 100;
        const avgImpliedDecimal = bucket.averageImpliedProbability;
        bucketAdjustment = (winRateDecimal - avgImpliedDecimal) * 0.3; // 30% weight
      }

      // Step 4: Apply signal weights
      const weights = modelState.signalWeights;
      const adjustedProb = 
        impliedProb * weights.oddsWeight +
        (impliedProb + bucketAdjustment) * weights.historicalBucketWeight +
        impliedProb * weights.recentBucketWeight +
        impliedProb * weights.consistencyWeight;

      // Step 5: Apply calibration scalar
      const calibratedProb = Math.min(1.0, Math.max(0.01, adjustedProb * modelState.calibrationScalar));

      // Calculate value edge: Adjusted - Implied
      const valueEdge = calibratedProb - impliedProb;

      return {
        index,
        odds,
        impliedProbability: impliedProb,
        adjustedProbability: calibratedProb,
        valueEdge,
      };
    });

    // Normalize probabilities to sum to 1.0
    const totalProb = contenders.reduce((sum, c) => sum + c.adjustedProbability, 0);
    contenders.forEach(c => {
      c.adjustedProbability = c.adjustedProbability / totalProb;
      c.valueEdge = c.adjustedProbability - c.impliedProbability;
    });

    return contenders;
  };

  const contenders = calculatePredictions();

  // Select recommended contender based on strategy mode
  const selectRecommendedContender = (): Contender => {
    switch (strategyMode) {
      case 'safe':
        // Highest adjusted probability
        return contenders.reduce((best, current) => 
          current.adjustedProbability > best.adjustedProbability ? current : best
        );
      
      case 'balanced':
        // Best combination of probability and value
        return contenders.reduce((best, current) => {
          const currentScore = current.adjustedProbability * 0.6 + current.valueEdge * 0.4;
          const bestScore = best.adjustedProbability * 0.6 + best.valueEdge * 0.4;
          return currentScore > bestScore ? current : best;
        });
      
      case 'value':
        // Highest value edge with minimum probability threshold
        const valueContenders = contenders.filter(c => c.adjustedProbability > 0.05);
        return valueContenders.reduce((best, current) => 
          current.valueEdge > best.valueEdge ? current : best
        );
      
      case 'aggressive':
        // High odds with positive value edge
        const aggressiveContenders = contenders.filter(c => c.odds >= 5 && c.valueEdge > 0);
        if (aggressiveContenders.length === 0) {
          return contenders.reduce((best, current) => 
            current.valueEdge > best.valueEdge ? current : best
          );
        }
        return aggressiveContenders.reduce((best, current) => 
          current.valueEdge > best.valueEdge ? current : best
        );
      
      default:
        return contenders[0];
    }
  };

  const recommended = selectRecommendedContender();

  // Calculate system-recommended bet sizing based on value edge
  const calculateSystemBetSize = (contender: Contender): number => {
    const baseAmount = 1000; // $1,000 base
    
    // If no meaningful positive edge, skip
    if (contender.valueEdge <= 0.02) {
      return 0; // SKIP THIS RACE
    }

    // Kelly Criterion approximation with conservative fractional Kelly (1/4)
    const kellyFraction = 0.25;
    const edge = contender.valueEdge;
    const kellyBet = baseAmount * edge * kellyFraction;

    // Apply strategy mode multipliers
    const strategyMultiplier = 
      strategyMode === 'safe' ? 0.5 :
      strategyMode === 'balanced' ? 1.0 :
      strategyMode === 'value' ? 1.5 :
      2.0; // aggressive

    const recommendedBet = Math.round(kellyBet * strategyMultiplier / 100) * 100;

    // Clamp to $1,000 - $10,000 range
    return Math.max(1000, Math.min(10000, recommendedBet));
  };

  const systemRecommendedBetSize = calculateSystemBetSize(recommended);

  // User-selected bet amount state (initialized to system recommendation)
  const [userBetAmount, setUserBetAmount] = useState<number>(
    systemRecommendedBetSize > 0 ? systemRecommendedBetSize : 1000
  );

  // Determine confidence level
  const confidenceLevel = 
    recommended.adjustedProbability > 0.4 ? 'high' :
    recommended.adjustedProbability > 0.25 ? 'medium' :
    'low';

  // Calculate potential profit and total return based on user-selected bet amount
  const calculatePotentialProfit = (betAmount: number): { profit: number; totalReturn: number } => {
    if (systemRecommendedBetSize === 0) {
      return { profit: 0, totalReturn: 0 };
    }
    
    // Profit = betAmount × odds
    const profit = betAmount * recommended.odds;
    // Total return = betAmount × (odds + 1)
    const totalReturn = betAmount * (recommended.odds + 1);
    
    return { profit, totalReturn };
  };

  const { profit: potentialProfit, totalReturn: potentialTotalReturn } = calculatePotentialProfit(userBetAmount);

  // Calculate profit/loss for fractional odds using user-selected bet amount
  const calculateProfitLoss = (winnerIndex: number): number => {
    if (systemRecommendedBetSize === 0) return 0;
    
    if (winnerIndex === recommended.index) {
      // Win: profit = betAmount × odds
      return userBetAmount * recommended.odds;
    } else {
      // Loss: lose the bet amount
      return -userBetAmount;
    }
  };

  // Calculate percentage difference between user selection and system recommendation
  const calculateBetDifference = (): number => {
    if (systemRecommendedBetSize === 0) return 0;
    return ((userBetAmount - systemRecommendedBetSize) / systemRecommendedBetSize) * 100;
  };

  const betDifference = calculateBetDifference();

  const handleResultSubmit = async () => {
    if (selectedWinner === null || selectedSecond === null || selectedThird === null) {
      toast.error('Please select all three positions');
      return;
    }

    const profitLoss = calculateProfitLoss(selectedWinner);

    const raceRecord: RaceRecordInput = {
      odds: oddsData.odds,
      impliedProbabilities,
      adjustedProbabilities: contenders.map(c => c.adjustedProbability),
      recommendedContender: recommended.index,
      recommendedBetSize: systemRecommendedBetSize,
      betAmount: userBetAmount, // Store user-selected bet amount
      actualFirst: selectedWinner,
      actualSecond: selectedSecond,
      actualThird: selectedThird,
      profitLoss,
      confidenceLevel,
      strategyMode,
      timestamp: Date.now(),
    };

    try {
      await logRaceToStorage(raceRecord);
      
      // Update signal weights based on outcome
      const updatedWeights = updateSignalWeights(
        modelState.signalWeights,
        { ...raceRecord, raceId: '' }, // raceId will be added by storage
        bucketStats
      );

      toast.success('Race logged successfully!', {
        description: profitLoss >= 0 ? `+$${profitLoss.toFixed(2)} profit` : `$${Math.abs(profitLoss).toFixed(2)} loss`
      });
      onComplete();
    } catch (error) {
      toast.error('Failed to log race');
      console.error(error);
    }
  };

  // Sort contenders by adjusted probability for display
  const sortedContenders = [...contenders].sort((a, b) => b.adjustedProbability - a.adjustedProbability);

  // Get confidence color
  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-primary';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-crimson';
      default: return 'text-foreground';
    }
  };

  const getConfidenceBg = (level: string) => {
    switch (level) {
      case 'high': return 'bg-primary/20 border-primary/30';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'bg-crimson/20 border-crimson/30';
      default: return 'bg-muted/20 border-border/30';
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
      {/* BEST BET - Hero Card */}
      <Card className={`border-2 shadow-glow-lg ${confidenceLevel === 'high' ? 'border-primary animate-pulse-glow' : 'border-primary/50'}`}>
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-primary/30">
          <CardTitle className="text-3xl font-black flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            BEST BET
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-5xl font-black mb-2">Horse #{recommended.index + 1}</div>
              <div className="text-xl text-muted-foreground font-mono font-bold">Odds: {recommended.odds}/1</div>
            </div>
            <div className="text-right space-y-2">
              <Badge variant="default" className="text-2xl font-black px-6 py-3 bg-primary text-primary-foreground">
                {(recommended.adjustedProbability * 100).toFixed(1)}%
              </Badge>
              <div className={`text-sm font-bold uppercase tracking-wide ${getConfidenceColor(confidenceLevel)}`}>
                {confidenceLevel} Confidence
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
            <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Implied Prob</div>
              <div className="text-2xl font-black tabular-nums">{(recommended.impliedProbability * 100).toFixed(1)}%</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Value Edge</div>
              <div className={`text-2xl font-black tabular-nums flex items-center gap-2 ${recommended.valueEdge > 0 ? 'text-primary' : 'text-crimson'}`}>
                {recommended.valueEdge > 0 ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                {recommended.valueEdge > 0 ? '+' : ''}{(recommended.valueEdge * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Strategy</div>
              <div className="text-2xl font-black uppercase">{strategyMode}</div>
            </div>
          </div>

          {systemRecommendedBetSize === 0 ? (
            <div className="p-6 rounded-xl bg-yellow-500/10 border-2 border-yellow-500/30 text-center">
              <div className="text-xl font-black text-yellow-500 mb-2">⚠️ SKIP THIS RACE</div>
              <div className="text-sm text-muted-foreground">No significant value edge detected</div>
            </div>
          ) : (
            <>
              {/* Bet Sizing */}
              <div className="space-y-4 p-6 rounded-xl bg-gradient-to-br from-card to-muted/20 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-black mb-1">Bet Amount</div>
                    <div className="text-sm text-muted-foreground">Adjust your wager ($1,000 - $10,000)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black font-mono tabular-nums text-primary">
                      ${userBetAmount.toLocaleString()}
                    </div>
                    {betDifference !== 0 && (
                      <div className={`text-sm font-semibold ${betDifference > 0 ? 'text-primary' : 'text-crimson'}`}>
                        {betDifference > 0 ? '+' : ''}{betDifference.toFixed(0)}% vs system
                      </div>
                    )}
                  </div>
                </div>

                <Slider
                  value={[userBetAmount]}
                  onValueChange={(values) => setUserBetAmount(values[0])}
                  min={1000}
                  max={10000}
                  step={1000}
                  className="py-4"
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">$1,000</span>
                  <span className="text-muted-foreground font-semibold">
                    System recommends: ${systemRecommendedBetSize.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">$10,000</span>
                </div>
              </div>

              {/* Potential Payout */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-primary/10 border-2 border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Potential Profit</div>
                  </div>
                  <div className="text-3xl font-black text-primary tabular-nums">
                    +${potentialProfit.toLocaleString()}
                  </div>
                </div>
                <div className="p-6 rounded-xl bg-accent/10 border-2 border-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-accent" />
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Return</div>
                  </div>
                  <div className="text-3xl font-black text-accent tabular-nums">
                    ${potentialTotalReturn.toLocaleString()}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* All Contenders */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
        <CardHeader>
          <CardTitle className="text-2xl font-black flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            All Contenders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedContenders.map((contender, idx) => (
            <div 
              key={contender.index}
              className={`p-4 rounded-xl border-2 transition-all animate-slide-in ${
                contender.index === recommended.index
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 bg-card/50'
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-black w-16">#{contender.index + 1}</div>
                  <div className="text-lg font-mono font-bold text-muted-foreground">{contender.odds}/1</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Probability</div>
                    <div className="text-xl font-black tabular-nums">{(contender.adjustedProbability * 100).toFixed(1)}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Value Edge</div>
                    <div className={`text-xl font-black tabular-nums ${contender.valueEdge > 0 ? 'text-primary' : 'text-crimson'}`}>
                      {contender.valueEdge > 0 ? '+' : ''}{(contender.valueEdge * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Result Logger */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
        <CardHeader>
          <CardTitle className="text-2xl font-black">Log Race Result</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Select the finishing positions</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {['First', 'Second', 'Third'].map((position, posIdx) => {
              const selected = posIdx === 0 ? selectedWinner : posIdx === 1 ? selectedSecond : selectedThird;
              const setSelected = posIdx === 0 ? setSelectedWinner : posIdx === 1 ? setSelectedSecond : setSelectedThird;
              
              return (
                <div key={position} className="space-y-3">
                  <div className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{position} Place</div>
                  <div className="grid grid-cols-2 gap-2">
                    {oddsData.odds.map((_, idx) => (
                      <Button
                        key={idx}
                        onClick={() => setSelected(idx)}
                        variant={selected === idx ? 'default' : 'outline'}
                        className={`h-14 text-lg font-black ${
                          selected === idx 
                            ? 'bg-primary text-primary-foreground shadow-glow' 
                            : 'hover:border-primary/50'
                        }`}
                      >
                        #{idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={handleResultSubmit}
            disabled={isLogging || selectedWinner === null || selectedSecond === null || selectedThird === null}
            className="w-full h-16 text-xl font-black bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-glow-lg hover:shadow-glow transition-all duration-300"
            size="lg"
          >
            {isLogging ? 'LOGGING...' : 'LOG RACE RESULT'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
