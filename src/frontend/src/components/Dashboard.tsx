import { useEffect, useState } from 'react';
import { useBettingHistory } from '../hooks/useBettingHistory';
import { 
  getOddsBucketStats, 
  getRaces, 
  getModelState, 
  getSessionStats,
  subscribeToStorageChanges 
} from '../lib/storage';
import { 
  calculateRecentAccuracy, 
  getBestPerformingBucket, 
  getWorstPerformingBucket 
} from '../lib/statsCalculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Gauge, 
  AlertCircle,
  PlayCircle,
  BarChart3,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountAnimation } from '../hooks/useCountAnimation';
import type { OddsBucketStats, ModelState, BettingHistory as BettingHistoryType, StrategyMode } from '../types/storage';

interface DashboardProps {
  onStartRace: () => void;
  onOpenSettings: () => void;
  currentStrategy: StrategyMode;
  showSession: boolean;
  onToggleView: () => void;
}

type ViewMode = 'session' | 'lifetime';

export function Dashboard({ onStartRace, onOpenSettings, currentStrategy, showSession, onToggleView }: DashboardProps) {
  const { bettingHistory: lifetimeHistory, isLoading } = useBettingHistory();
  const [viewMode, setViewMode] = useState<ViewMode>(showSession ? 'session' : 'lifetime');
  const [sessionHistory, setSessionHistory] = useState<BettingHistoryType | null>(null);
  const [bucketStats, setBucketStats] = useState<OddsBucketStats | null>(null);
  const [modelState, setModelState] = useState<ModelState | null>(null);

  // Sync viewMode with showSession prop
  useEffect(() => {
    setViewMode(showSession ? 'session' : 'lifetime');
  }, [showSession]);

  // Load all stats and subscribe to changes
  useEffect(() => {
    const loadStats = () => {
      const stats = getOddsBucketStats();
      setBucketStats(stats);
      
      const state = getModelState();
      setModelState(state);

      const sessionStats = getSessionStats();
      setSessionHistory(sessionStats);
    };

    loadStats();
    const unsubscribe = subscribeToStorageChanges(loadStats);
    return unsubscribe;
  }, []);

  const currentHistory = viewMode === 'session' ? sessionHistory : lifetimeHistory;
  const totalRaces = currentHistory?.totalRaces || 0;
  const roiPercentage = currentHistory?.cumulativeROI || 0;
  const winRate = currentHistory?.winRate || 0;
  const totalProfit = currentHistory?.totalProfit || 0;
  const isPositiveROI = roiPercentage > 0;

  // Animated values
  const animatedRaces = useCountAnimation(totalRaces);
  const animatedProfit = useCountAnimation(totalProfit);
  const animatedROI = useCountAnimation(roiPercentage);
  const animatedWinRate = useCountAnimation(winRate);

  const races = getRaces();
  const recentAccuracy = calculateRecentAccuracy(races, 10);
  const overallAccuracy = winRate;

  // Calibration interpretation
  const calibrationScalar = modelState?.calibrationScalar || 1.0;
  const calibrationScore = (calibrationScalar * 100).toFixed(0);
  const calibrationStatus = 
    calibrationScalar > 1.1 ? 'Overconfident' :
    calibrationScalar < 0.9 ? 'Underconfident' :
    'Well-calibrated';

  // Confidence level
  const confidenceLevel = 
    calibrationScalar >= 0.95 && calibrationScalar <= 1.05 ? 'High' :
    calibrationScalar >= 0.85 && calibrationScalar <= 1.15 ? 'Medium' :
    'Low';

  // Drift status
  const driftDetected = modelState?.driftDetectionState?.driftDetected || false;

  // Best/worst buckets
  const bestBucket = bucketStats ? getBestPerformingBucket(bucketStats) : 'N/A';
  const worstBucket = bucketStats ? getWorstPerformingBucket(bucketStats) : 'N/A';

  // Strategy mode display
  const strategyMode = currentStrategy.toUpperCase();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tight mb-2">Dashboard</h2>
          <p className="text-muted-foreground">Track your performance and model health</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => {
            setViewMode(v as ViewMode);
            onToggleView();
          }}>
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="session" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Session
              </TabsTrigger>
              <TabsTrigger value="lifetime" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Lifetime
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={onOpenSettings}
            variant="outline"
            size="icon"
            className="border-border hover:border-primary hover:bg-primary/10"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Primary Action - Hero Button */}
      <Button 
        onClick={onStartRace} 
        size="lg" 
        className="w-full h-20 text-2xl font-black bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-glow-lg hover:shadow-glow transition-all duration-300 group"
      >
        <PlayCircle className="h-8 w-8 mr-3 group-hover:scale-110 transition-transform" />
        START NEW RACE
      </Button>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            icon: Activity,
            label: 'Total Races',
            value: Math.round(animatedRaces),
            color: 'text-foreground',
            delay: '0ms'
          },
          {
            icon: totalProfit >= 0 ? TrendingUp : TrendingDown,
            label: 'Profit/Loss',
            value: `${totalProfit >= 0 ? '+' : ''}$${animatedProfit.toFixed(2)}`,
            color: totalProfit >= 0 ? 'text-primary' : 'text-crimson',
            delay: '50ms'
          },
          {
            icon: Target,
            label: 'ROI',
            value: `${roiPercentage >= 0 ? '+' : ''}${animatedROI.toFixed(1)}%`,
            color: isPositiveROI ? 'text-primary' : 'text-crimson',
            delay: '100ms'
          },
          {
            icon: Target,
            label: 'Win Rate',
            value: `${animatedWinRate.toFixed(0)}%`,
            color: 'text-foreground',
            delay: '150ms'
          }
        ].map((metric, idx) => (
          <Card 
            key={idx} 
            className="card-hover border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium animate-slide-up"
            style={{ animationDelay: metric.delay }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                <metric.icon className="h-4 w-4" />
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full animate-shimmer" />
              ) : (
                <div className={`text-4xl font-black tabular-nums ${metric.color}`}>
                  {metric.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accuracy & Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Accuracy Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Overall</div>
                <div className="text-3xl font-black tabular-nums">{overallAccuracy.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Recent (10)</div>
                <div className="text-3xl font-black tabular-nums">{recentAccuracy.toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Current Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-2xl font-black px-6 py-3 border-2 border-primary text-primary">
                {strategyMode}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Health */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
        <CardHeader>
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Model Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Calibration</span>
              <div className="flex items-center gap-3">
                <span className="text-xl font-black tabular-nums">{calibrationScore}%</span>
                <Badge 
                  variant={calibrationScalar >= 0.9 && calibrationScalar <= 1.1 ? 'default' : 'outline'}
                  className={calibrationScalar >= 0.9 && calibrationScalar <= 1.1 ? 'bg-primary text-primary-foreground' : ''}
                >
                  {calibrationStatus}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Confidence</span>
              <Badge 
                variant={
                  confidenceLevel === 'High' ? 'default' : 
                  confidenceLevel === 'Medium' ? 'secondary' : 
                  'outline'
                }
                className={
                  confidenceLevel === 'High' ? 'bg-primary text-primary-foreground text-lg px-4 py-1' :
                  confidenceLevel === 'Medium' ? 'text-lg px-4 py-1' :
                  'text-lg px-4 py-1'
                }
              >
                {confidenceLevel}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Drift Status</span>
              <div className="flex items-center gap-2">
                {driftDetected && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                <Badge variant={driftDetected ? 'outline' : 'default'} className={driftDetected ? 'border-yellow-500 text-yellow-500' : 'bg-primary text-primary-foreground'}>
                  {driftDetected ? 'Detected' : 'Stable'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Odds Bucket Performance */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
        <CardHeader>
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Odds Bucket Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {bucketStats && Object.entries(bucketStats).map(([bucket, stats]) => {
              const hasSufficientData = stats.totalRaces >= 10;
              const roi = stats.roi || 0;
              const isPositive = roi > 0;
              
              return (
                <div key={bucket} className="p-4 rounded-xl bg-muted/20 border border-border/50 hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black">{bucket}</span>
                      <Badge variant={hasSufficientData ? 'default' : 'outline'} className={hasSufficientData ? 'bg-primary/20 text-primary border-primary' : ''}>
                        {stats.totalRaces} races
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Win Rate</div>
                        <div className="text-lg font-black tabular-nums">{stats.actualWinRate.toFixed(1)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">ROI</div>
                        <div className={`text-lg font-black tabular-nums ${isPositive ? 'text-primary' : 'text-crimson'}`}>
                          {isPositive ? '+' : ''}{roi.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Visual bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-gradient-to-r from-primary to-accent' : 'bg-crimson'}`}
                      style={{ width: `${Math.min(100, Math.abs(roi) * 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <div className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Best Bucket</div>
              <div className="text-2xl font-black text-primary">{bestBucket}</div>
            </div>
            <div className="p-4 rounded-xl bg-crimson/10 border border-crimson/30">
              <div className="text-sm font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Worst Bucket</div>
              <div className="text-2xl font-black text-crimson">{worstBucket}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
