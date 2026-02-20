import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, AlertTriangle, Sparkles } from 'lucide-react';
import type { OddsOnlyData, StrategyMode } from '@/types/storage';

interface OddsEntryFormProps {
  onSubmit: (data: OddsOnlyData) => void;
  strategyMode: StrategyMode;
  onStrategyModeChange: (mode: StrategyMode) => void;
}

const STRATEGY_MODES: { value: StrategyMode; label: string; description: string; icon: string }[] = [
  { value: 'safe', label: 'Safe', description: 'Highest probability', icon: '🛡️' },
  { value: 'balanced', label: 'Balanced', description: 'Mix of probability & value', icon: '⚖️' },
  { value: 'value', label: 'Value', description: 'Best value edge', icon: '💎' },
  { value: 'aggressive', label: 'Aggressive', description: 'High-odds value plays', icon: '🚀' },
];

export function OddsEntryForm({ onSubmit, strategyMode, onStrategyModeChange }: OddsEntryFormProps) {
  const [odds, setOdds] = useState<string[]>(['', '', '', '', '', '']);
  const [errors, setErrors] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  useEffect(() => {
    // Auto-focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);
  
  const handleOddsChange = (index: number, value: string) => {
    // Allow empty string or digits only (no validation yet)
    if (value === '' || /^\d+$/.test(value)) {
      const newOdds = [...odds];
      newOdds[index] = value;
      setOdds(newOdds);
      
      // Clear error for this field when user starts typing
      if (errors[index]) {
        const newErrors = [...errors];
        newErrors[index] = '';
        setErrors(newErrors);
      }
    }
  };
  
  const validateField = (index: number, value: string): string => {
    if (value === '') {
      return 'Required';
    }
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 30) {
      return 'Must be 1-30';
    }
    return '';
  };
  
  const handleBlur = (index: number) => {
    const error = validateField(index, odds[index]);
    const newErrors = [...errors];
    newErrors[index] = error;
    setErrors(newErrors);
  };
  
  const handleFocus = (index: number) => {
    // Clear error when user focuses field for clean editing experience
    if (errors[index]) {
      const newErrors = [...errors];
      newErrors[index] = '';
      setErrors(newErrors);
    }
  };
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Validate current field
      const error = validateField(index, odds[index]);
      if (error) {
        const newErrors = [...errors];
        newErrors[index] = error;
        setErrors(newErrors);
        return;
      }
      
      // Move to next field or submit
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // On last field, validate all and submit
        handleSubmit(odds);
      }
    }
  };
  
  const handleSubmit = (currentOdds: string[]) => {
    // Validate all fields
    const newErrors = currentOdds.map((value, index) => validateField(index, value));
    setErrors(newErrors);
    
    // Only submit if all fields are valid
    if (newErrors.every(e => e === '')) {
      const oddsNumbers = currentOdds.map(o => parseInt(o));
      onSubmit({ odds: oddsNumbers });
    }
  };
  
  /**
   * Calculate implied probability using correct fractional odds formula
   * For odds X/1: Implied Probability = 1 / (X + 1)
   */
  const calculateImpliedProb = (oddsValue: string): number => {
    if (oddsValue === '') return 0;
    const oddsNum = parseInt(oddsValue);
    if (isNaN(oddsNum)) return 0;
    // CORRECT FORMULA: 1 / (odds + 1)
    return (1 / (oddsNum + 1)) * 100;
  };
  
  const totalImplied = odds.reduce((sum, o) => sum + calculateImpliedProb(o), 0);
  const overround = totalImplied - 100;
  const allFilled = odds.every(o => o !== '');
  const allValid = allFilled && odds.every((o, i) => validateField(i, o) === '');
  
  // Flag extreme overround values
  const isExtremeOverround = allFilled && (totalImplied > 120 || totalImplied < 95);
  
  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-slide-up">
      {/* Strategy Mode Selector */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
        <CardHeader>
          <CardTitle className="text-2xl font-black flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Strategy Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {STRATEGY_MODES.map((mode, idx) => (
              <button
                key={mode.value}
                onClick={() => onStrategyModeChange(mode.value)}
                className={`p-6 rounded-xl border-2 transition-all text-left group hover:scale-[1.02] animate-slide-up ${
                  strategyMode === mode.value
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border/50 hover:border-primary/50 bg-card/50'
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{mode.icon}</span>
                  <div className="text-xl font-black">{mode.label}</div>
                </div>
                <div className="text-sm text-muted-foreground">{mode.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Odds Entry */}
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 shadow-premium">
        <CardHeader>
          <CardTitle className="text-2xl font-black">Enter Odds</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Enter fractional odds (1-30) for each horse</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {odds.map((value, index) => (
            <div 
              key={index} 
              className="space-y-1 animate-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div 
                className={`flex items-center gap-4 p-4 rounded-xl bg-muted/20 border transition-all ${
                  errors[index] 
                    ? 'border-destructive/50 bg-destructive/5' 
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                <Label className="w-16 font-black text-xl text-muted-foreground">#{index + 1}</Label>
                <div className="flex-1 flex items-center gap-3">
                  <Input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => handleOddsChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onBlur={() => handleBlur(index)}
                    onFocus={() => handleFocus(index)}
                    placeholder="1-30"
                    className={`text-2xl font-mono font-bold h-14 bg-input border-2 transition-all tabular-nums ${
                      errors[index]
                        ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                        : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
                    }`}
                  />
                  <span className="text-xl text-muted-foreground font-mono">/1</span>
                </div>
                <div className="w-28 text-right">
                  {value && !errors[index] && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30">
                      <span className="text-sm font-bold text-accent tabular-nums">
                        {calculateImpliedProb(value).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {errors[index] && (
                <div className="flex items-center gap-2 text-destructive text-sm font-semibold px-4">
                  <AlertCircle className="h-4 w-4" />
                  {errors[index]}
                </div>
              )}
            </div>
          ))}
          
          {/* Gradient Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-6" />
          
          {/* Total Implied & Overround */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/20 border border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Total Implied Probability</span>
              <span className="text-2xl font-black tabular-nums">{totalImplied.toFixed(1)}%</span>
            </div>
            {allFilled && overround > 0 && (
              <div className="flex items-center gap-2 text-yellow-500 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-semibold">
                  Overround: +{overround.toFixed(1)}% (normal bookmaker edge)
                </span>
              </div>
            )}
            {isExtremeOverround && (
              <div className="flex items-center gap-2 text-orange-500 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-bold">
                  Warning: Extreme overround detected ({totalImplied.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
          
          <Button
            onClick={() => handleSubmit(odds)}
            disabled={!allValid}
            className="w-full h-16 text-xl font-black bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-glow hover:shadow-glow-lg transition-all duration-300 mt-6"
            size="lg"
          >
            CALCULATE PICK
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
