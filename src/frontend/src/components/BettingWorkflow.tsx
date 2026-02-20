import { useState } from 'react';
import { Dashboard } from './Dashboard';
import { OddsEntryForm } from './OddsEntryForm';
import { PredictionAndResults } from './PredictionAndResults';
import { Settings } from './Settings';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, Calculator, Trophy } from 'lucide-react';
import type { OddsOnlyData, StrategyMode } from '@/types/storage';

type WorkflowPhase = 'dashboard' | 'odds-entry' | 'prediction';

export function BettingWorkflow() {
  const [phase, setPhase] = useState<WorkflowPhase>('dashboard');
  const [oddsData, setOddsData] = useState<OddsOnlyData | null>(null);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>('balanced');
  const [showSession, setShowSession] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleStartRace = () => {
    setPhase('odds-entry');
  };

  const handleOddsSubmit = (data: OddsOnlyData) => {
    setOddsData(data);
    setPhase('prediction');
  };

  const handleRaceComplete = () => {
    setOddsData(null);
    setPhase('dashboard');
  };

  const handleToggleView = () => {
    setShowSession(!showSession);
  };

  return (
    <div className="space-y-8">
      {/* Phase Navigation */}
      <div className="flex justify-center">
        <Tabs value={phase} onValueChange={(v) => setPhase(v as WorkflowPhase)} className="w-full max-w-2xl">
          <TabsList className="grid w-full grid-cols-3 h-14 bg-card border border-border shadow-premium">
            <TabsTrigger 
              value="dashboard" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground font-bold text-base transition-all duration-300"
            >
              <LayoutDashboard className="h-5 w-5 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="odds-entry"
              disabled={phase === 'dashboard'}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground font-bold text-base transition-all duration-300"
            >
              <Calculator className="h-5 w-5 mr-2" />
              Enter Odds
            </TabsTrigger>
            <TabsTrigger 
              value="prediction"
              disabled={phase !== 'prediction'}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground font-bold text-base transition-all duration-300"
            >
              <Trophy className="h-5 w-5 mr-2" />
              Prediction
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Phase Content */}
      <div className="animate-fade-in">
        {phase === 'dashboard' && (
          <Dashboard
            onStartRace={handleStartRace}
            onOpenSettings={() => setSettingsOpen(true)}
            currentStrategy={strategyMode}
            showSession={showSession}
            onToggleView={handleToggleView}
          />
        )}

        {phase === 'odds-entry' && (
          <OddsEntryForm
            onSubmit={handleOddsSubmit}
            strategyMode={strategyMode}
            onStrategyModeChange={setStrategyMode}
          />
        )}

        {phase === 'prediction' && oddsData && (
          <PredictionAndResults
            oddsData={oddsData}
            strategyMode={strategyMode}
            onComplete={handleRaceComplete}
          />
        )}
      </div>

      {/* Settings Modal */}
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
