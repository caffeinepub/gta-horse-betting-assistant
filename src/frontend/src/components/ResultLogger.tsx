import { useState } from 'react';
import { useLogRace } from '../hooks/useQueries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Horse } from '../backend';
import type { HorseWithName } from './OddsEntryForm';
import { cn } from '@/lib/utils';

interface ResultLoggerProps {
  horses: HorseWithName[];
  onResultLogged: () => void;
  onReset: () => void;
}

export function ResultLogger({ horses, onResultLogged, onReset }: ResultLoggerProps) {
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const logRaceMutation = useLogRace();

  const handleSelectWinner = (horseName: string) => {
    setSelectedWinner(horseName);
  };

  const handleSubmit = () => {
    if (!selectedWinner) {
      toast.error('Select the winning horse');
      return;
    }

    // Calculate predicted probabilities and mark the winner
    const totalImplied = horses.reduce((sum, horse) => sum + 1 / horse.odds, 0);
    
    const horsesWithOutcome: Horse[] = horses.map((h) => {
      const impliedProb = 1 / h.odds;
      const normalizedProb = impliedProb / totalImplied;

      return {
        odds: h.odds,
        actualOutcome: h.name === selectedWinner,
        predictedProb: normalizedProb,
      };
    });

    logRaceMutation.mutate(horsesWithOutcome, {
      onSuccess: () => {
        toast.success('Race logged! Learning system updated.');
        onResultLogged();
      },
      onError: () => {
        toast.error('Failed to log race result');
      },
    });
  };

  return (
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
              disabled={logRaceMutation.isPending}
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
            disabled={logRaceMutation.isPending}
            className="flex-1 font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedWinner || logRaceMutation.isPending}
            className="flex-1 font-bold text-base"
            size="lg"
          >
            {logRaceMutation.isPending ? (
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
  );
}
