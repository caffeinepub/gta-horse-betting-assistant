import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface OddsOnlyData {
  odds: number[];
  strategyMode: 'Safe' | 'Balanced' | 'Value' | 'Aggressive';
}

interface OddsEntryFormProps {
  onSubmit: (data: OddsOnlyData) => void;
}

const STRATEGY_MODES = ['Safe', 'Balanced', 'Value', 'Aggressive'] as const;

export function OddsEntryForm({ onSubmit }: OddsEntryFormProps) {
  const [oddsValues, setOddsValues] = useState<string[]>(['', '', '', '', '', '']);
  const [strategyMode, setStrategyMode] = useState<'Safe' | 'Balanced' | 'Value' | 'Aggressive'>('Balanced');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load strategy mode from localStorage on mount
  useEffect(() => {
    const savedStrategy = localStorage.getItem('strategyMode');
    if (savedStrategy && STRATEGY_MODES.includes(savedStrategy as any)) {
      setStrategyMode(savedStrategy as 'Safe' | 'Balanced' | 'Value' | 'Aggressive');
    }
  }, []);

  // Auto-focus on first field on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Persist strategy mode to localStorage
  useEffect(() => {
    localStorage.setItem('strategyMode', strategyMode);
  }, [strategyMode]);

  const validateOdds = (value: string): boolean => {
    if (value === '') return false;
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= 1 && num <= 30 && value === num.toString();
  };

  const handleOddsChange = (index: number, value: string) => {
    // Allow empty string or valid integer input
    if (value === '' || /^\d+$/.test(value)) {
      const num = parseInt(value, 10);
      // Only update if empty or within range
      if (value === '' || (num >= 1 && num <= 30)) {
        const updated = [...oddsValues];
        updated[index] = value;
        setOddsValues(updated);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Check if current field has valid value
      if (!validateOdds(oddsValues[index])) {
        toast.error('Enter a valid odds value (1-30) before continuing');
        return;
      }

      // If this is the last field (#6), submit the form
      if (index === 5) {
        handleSubmit(e as any);
      } else {
        // Move to next field
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const calculateImpliedProbability = (odds: string): string => {
    if (!validateOdds(odds)) return '—';
    const num = parseInt(odds, 10);
    const prob = (1 / num) * 100;
    return prob.toFixed(2) + '%';
  };

  const calculateTotalImpliedProbability = (): number => {
    let total = 0;
    for (const odds of oddsValues) {
      if (validateOdds(odds)) {
        const num = parseInt(odds, 10);
        total += (1 / num) * 100;
      }
    }
    return total;
  };

  const totalImpliedProb = calculateTotalImpliedProbability();
  const hasOverround = totalImpliedProb > 100;

  const isFormValid = oddsValues.every(validateOdds);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      toast.error('All six odds fields must be filled with values 1-30');
      return;
    }

    const data: OddsOnlyData = {
      odds: oddsValues.map(v => parseInt(v, 10)),
      strategyMode,
    };

    onSubmit(data);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-2xl font-black uppercase">Enter Race Odds</CardTitle>
        <CardDescription className="text-base">
          Enter odds for exactly six contenders (integers 1-30 only)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Six fixed odds rows */}
          <div className="space-y-3">
            {oddsValues.map((odds, index) => (
              <div key={index} className="flex items-center gap-3">
                <Label className="text-sm font-bold w-8">
                  #{index + 1}
                </Label>
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    value={odds}
                    onChange={(e) => handleOddsChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="font-semibold text-lg w-24"
                  />
                  <span className="text-muted-foreground font-medium">/1</span>
                  <span className="ml-auto text-sm font-semibold text-muted-foreground min-w-[80px] text-right">
                    {calculateImpliedProbability(odds)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total implied probability and overround warning */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
              <span className="font-bold text-sm uppercase">Total Implied Probability:</span>
              <span className={`font-black text-lg ${hasOverround ? 'text-destructive' : 'text-foreground'}`}>
                {totalImpliedProb.toFixed(2)}%
              </span>
            </div>
            
            {hasOverround && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-semibold">
                  Overround detected: Bookmaker margin present ({(totalImpliedProb - 100).toFixed(2)}%)
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Strategy Mode Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase">Strategy Mode</Label>
            <RadioGroup value={strategyMode} onValueChange={(value) => setStrategyMode(value as any)}>
              <div className="grid grid-cols-2 gap-3">
                {STRATEGY_MODES.map((mode) => (
                  <div key={mode} className="flex items-center space-x-2">
                    <RadioGroupItem value={mode} id={mode} />
                    <Label htmlFor={mode} className="font-semibold cursor-pointer">
                      {mode}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full font-bold text-base uppercase" 
            size="lg"
            disabled={!isFormValid}
          >
            Enter / Calculate Pick
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
