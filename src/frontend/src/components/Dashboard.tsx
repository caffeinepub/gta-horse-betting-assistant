import { ROIDashboard } from './ROIDashboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-accent bg-accent/5">
        <CardHeader>
          <CardTitle className="text-3xl font-black uppercase flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-accent" />
            Performance Dashboard
          </CardTitle>
          <CardDescription className="text-base">
            Track your betting performance and ROI across all races
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <ROIDashboard />
        
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-bold text-accent mb-1">1. Enter Odds</h4>
              <p className="text-muted-foreground">
                Input horse names and their betting odds for the upcoming race.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-accent mb-1">2. Get Predictions</h4>
              <p className="text-muted-foreground">
                Our system analyzes odds and provides recommended picks with value bet detection.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-accent mb-1">3. Log Results</h4>
              <p className="text-muted-foreground">
                After the race, record the winner to help the system learn and improve.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-accent mb-1">4. Track Performance</h4>
              <p className="text-muted-foreground">
                Monitor your ROI and win rate as the system adapts to your betting patterns.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
