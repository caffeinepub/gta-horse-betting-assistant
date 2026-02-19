import { Check, TrendingUp, ClipboardCheck, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type WorkflowPhase = 'entry' | 'prediction' | 'result' | 'learning';

interface WorkflowIndicatorProps {
  currentPhase: WorkflowPhase;
}

const phases = [
  { id: 'entry', label: 'Enter', icon: ClipboardCheck },
  { id: 'prediction', label: 'Predict', icon: TrendingUp },
  { id: 'result', label: 'Log', icon: Check },
  { id: 'learning', label: 'Learn', icon: Brain },
] as const;

export function WorkflowIndicator({ currentPhase }: WorkflowIndicatorProps) {
  const currentIndex = phases.findIndex((p) => p.id === currentPhase);
  const currentPhaseData = phases[currentIndex];
  const Icon = currentPhaseData.icon;

  return (
    <div className="flex items-center justify-center">
      <Badge variant="outline" className="px-4 py-2 text-sm font-bold">
        <Icon className="h-4 w-4 mr-2 text-accent" />
        <span className="text-muted-foreground">Phase:</span>
        <span className="ml-1 text-accent">{currentPhaseData.label}</span>
        <span className="ml-2 text-muted-foreground">
          ({currentIndex + 1}/4)
        </span>
      </Badge>
    </div>
  );
}
