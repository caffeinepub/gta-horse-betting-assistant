import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, ClipboardCheck, TrendingUp } from 'lucide-react';
import { OddsEntryForm, type OddsOnlyData } from './OddsEntryForm';
import { PredictionAndResults } from './PredictionAndResults';
import { Dashboard } from './Dashboard';
import { WorkflowIndicator } from './WorkflowIndicator';

type WorkflowPhase = 'entry' | 'prediction' | 'result' | 'learning';
type Screen = 'dashboard' | 'odds-entry' | 'prediction-results';

export function BettingWorkflow() {
  const [phase, setPhase] = useState<WorkflowPhase>('entry');
  const [currentRaceData, setCurrentRaceData] = useState<OddsOnlyData | null>(null);
  const [activeScreen, setActiveScreen] = useState<Screen>('odds-entry');

  const handleOddsSubmit = (data: OddsOnlyData) => {
    setCurrentRaceData(data);
    setPhase('prediction');
    setActiveScreen('prediction-results');
  };

  const handleResultLogged = () => {
    setPhase('learning');
    // Auto-reset after brief delay
    setTimeout(() => {
      handleReset();
    }, 1500);
  };

  const handleReset = () => {
    // Clear all race data
    setCurrentRaceData(null);
    setPhase('entry');
    setActiveScreen('odds-entry');
  };

  // Determine which screen to show based on phase and active screen
  const getScreenToShow = (): Screen => {
    // Dashboard is always accessible
    if (activeScreen === 'dashboard') return 'dashboard';
    
    // If in prediction or result phase, show prediction-results
    if (phase === 'prediction' || phase === 'result') {
      return 'prediction-results';
    }
    
    // Default to odds entry
    return 'odds-entry';
  };

  const screenToShow = getScreenToShow();

  return (
    <div className="space-y-4">
      {/* Minimized workflow indicator */}
      <WorkflowIndicator currentPhase={phase} />

      {/* Three-screen navigation */}
      <Tabs value={screenToShow} onValueChange={(value) => setActiveScreen(value as Screen)}>
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger 
            value="dashboard" 
            className="flex items-center gap-2 py-3 font-bold text-sm"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger 
            value="odds-entry" 
            className="flex items-center gap-2 py-3 font-bold text-sm"
          >
            <ClipboardCheck className="h-4 w-4" />
            Odds Entry
          </TabsTrigger>
          <TabsTrigger 
            value="prediction-results" 
            className="flex items-center gap-2 py-3 font-bold text-sm"
            disabled={!currentRaceData}
          >
            <TrendingUp className="h-4 w-4" />
            Prediction + Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <Dashboard />
        </TabsContent>

        <TabsContent value="odds-entry" className="mt-6">
          <OddsEntryForm onSubmit={handleOddsSubmit} />
        </TabsContent>

        <TabsContent value="prediction-results" className="mt-6">
          {currentRaceData ? (
            <PredictionAndResults
              raceData={currentRaceData}
              onResultLogged={handleResultLogged}
              onReset={handleReset}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">No race data available. Enter odds first.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Learning phase overlay */}
      {phase === 'learning' && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border-2 border-accent rounded-lg p-8 text-center max-w-md">
            <div className="animate-pulse">
              <h3 className="text-2xl font-bold text-accent mb-2">
                Learning from Results...
              </h3>
              <p className="text-muted-foreground">
                Updating trust weights and calibration
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
