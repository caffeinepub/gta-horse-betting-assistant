import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export interface HorseWithName {
  name: string;
  odds: number;
}

interface OddsEntryFormProps {
  onSubmit: (horses: HorseWithName[]) => void;
}

interface HorseInput {
  name: string;
  odds: string;
}

export function OddsEntryForm({ onSubmit }: OddsEntryFormProps) {
  const [horseInputs, setHorseInputs] = useState<HorseInput[]>([
    { name: '', odds: '' },
    { name: '', odds: '' },
  ]);

  const addHorse = () => {
    setHorseInputs([...horseInputs, { name: '', odds: '' }]);
  };

  const removeHorse = (index: number) => {
    if (horseInputs.length <= 2) {
      toast.error('Need at least 2 horses');
      return;
    }
    setHorseInputs(horseInputs.filter((_, i) => i !== index));
  };

  const updateHorse = (index: number, field: 'name' | 'odds', value: string) => {
    const updated = [...horseInputs];
    updated[index][field] = value;
    setHorseInputs(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    const validHorses = horseInputs.filter((h) => h.name.trim() && h.odds.trim());

    if (validHorses.length < 2) {
      toast.error('Enter at least 2 horses with odds');
      return;
    }

    // Convert to HorseWithName type
    const horses: HorseWithName[] = validHorses.map((h) => ({
      name: h.name.trim(),
      odds: parseFloat(h.odds),
    }));

    // Validate odds
    const invalidOdds = horses.some((h) => isNaN(h.odds) || h.odds <= 0);
    if (invalidOdds) {
      toast.error('All odds must be positive numbers');
      return;
    }

    // Check for duplicate names
    const names = horses.map((h) => h.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error('Horse names must be unique');
      return;
    }

    onSubmit(horses);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-2xl font-black uppercase">Enter Race Odds</CardTitle>
        <CardDescription className="text-base">
          Add horses and their betting odds. Odds format: 2.5 means 2.5:1 payout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {horseInputs.map((horse, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor={`horse-${index}`} className="text-xs font-bold uppercase">
                    Horse Name
                  </Label>
                  <Input
                    id={`horse-${index}`}
                    placeholder="Enter name"
                    value={horse.name}
                    onChange={(e) => updateHorse(index, 'name', e.target.value)}
                    className="font-semibold"
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor={`odds-${index}`} className="text-xs font-bold uppercase">
                    Odds
                  </Label>
                  <Input
                    id={`odds-${index}`}
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder="2.5"
                    value={horse.odds}
                    onChange={(e) => updateHorse(index, 'odds', e.target.value)}
                    className="font-semibold"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => removeHorse(index)}
                  disabled={horseInputs.length <= 2}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addHorse}
              className="flex-1 font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Horse
            </Button>
            <Button type="submit" className="flex-1 font-bold text-base" size="lg">
              Get Predictions
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
