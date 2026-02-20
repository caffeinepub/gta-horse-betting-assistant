import { useState } from 'react';
import { softReset, fullReset, exportAllData, getRaces } from '../lib/storage';
import { useUndoRace } from '../hooks/useUndoRace';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Undo2, RotateCcw, Trash2, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const { undoRace, isUndoing } = useUndoRace();
  const [showSoftResetDialog, setShowSoftResetDialog] = useState(false);
  const [showFullResetDialog, setShowFullResetDialog] = useState(false);

  const races = getRaces();
  const raceCount = races.length;

  const handleUndoLastRace = async () => {
    const success = await undoRace();
    if (success) {
      toast.success('Last race undone successfully');
    } else {
      toast.error('Failed to undo last race');
    }
  };

  const handleSoftReset = () => {
    softReset();
    setShowSoftResetDialog(false);
    toast.success('Session stats reset. Learning data preserved.');
    onOpenChange(false);
  };

  const handleFullReset = () => {
    fullReset();
    setShowFullResetDialog(false);
    toast.success('All data deleted. System reset to initial state.');
    onOpenChange(false);
  };

  const handleExport = () => {
    try {
      exportAllData();
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border/50 shadow-premium animate-scale-in">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black">Settings</DialogTitle>
            <DialogDescription className="text-base">
              Manage your betting system data and configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6">
            {/* Undo Last Race */}
            <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:border-primary/30 transition-colors">
              <CardHeader>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Undo2 className="h-5 w-5 text-foreground" />
                  Undo Last Race
                </CardTitle>
                <CardDescription className="text-sm">
                  Remove the last race and restore previous model state
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleUndoLastRace}
                  disabled={isUndoing || raceCount === 0}
                  variant="outline"
                  className="w-full h-12 font-bold border-2 hover:border-primary hover:bg-primary/10"
                >
                  {isUndoing ? 'Undoing...' : raceCount === 0 ? 'No races to undo' : 'Undo Last Race'}
                </Button>
              </CardContent>
            </Card>

            {/* Soft Reset */}
            <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:border-primary/30 transition-colors">
              <CardHeader>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-foreground" />
                  Soft Reset
                </CardTitle>
                <CardDescription className="text-sm">
                  Reset session statistics while preserving all learning data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowSoftResetDialog(true)}
                  variant="outline"
                  className="w-full h-12 font-bold border-2 hover:border-primary hover:bg-primary/10"
                >
                  Reset Session Stats
                </Button>
              </CardContent>
            </Card>

            {/* Export Data */}
            <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 hover:border-accent/30 transition-colors">
              <CardHeader>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Download className="h-5 w-5 text-accent" />
                  Export Data
                </CardTitle>
                <CardDescription className="text-sm">
                  Download all races, model state, and statistics as JSON
                  {raceCount > 0 && <span className="ml-2 font-semibold text-accent">({raceCount} races stored)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleExport} 
                  variant="outline" 
                  className="w-full h-12 font-bold border-2 border-accent/50 hover:border-accent hover:bg-accent/10 text-accent"
                >
                  Export All Data
                </Button>
              </CardContent>
            </Card>

            {/* Full Reset - Destructive */}
            <Card className="border-2 border-crimson/50 bg-gradient-to-br from-crimson/5 to-crimson/10">
              <CardHeader>
                <CardTitle className="text-xl font-black flex items-center gap-2 text-crimson">
                  <Trash2 className="h-5 w-5" />
                  Full Reset
                </CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-2 text-crimson font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Permanently delete all data and reset system
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowFullResetDialog(true)}
                  variant="destructive"
                  className="w-full h-12 font-black bg-crimson hover:bg-crimson/90 text-destructive-foreground"
                >
                  Delete All Data
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Soft Reset Confirmation */}
      <AlertDialog open={showSoftResetDialog} onOpenChange={setShowSoftResetDialog}>
        <AlertDialogContent className="bg-card border-border/50 shadow-premium animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Reset Session Statistics?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This will reset your session statistics (races, profit/loss, ROI) to zero.
              <br />
              <br />
              <strong className="text-foreground">Your learning data will be preserved:</strong>
              <ul className="list-disc list-inside mt-3 space-y-2 text-sm">
                <li>All race records</li>
                <li>Model weights and calibration</li>
                <li>Odds bucket statistics</li>
                <li>Betting history</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSoftReset} className="bg-primary hover:bg-primary/90 font-bold">
              Reset Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Reset Confirmation */}
      <AlertDialog open={showFullResetDialog} onOpenChange={setShowFullResetDialog}>
        <AlertDialogContent className="bg-card border-crimson/50 shadow-premium animate-scale-in">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-crimson flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Delete All Data?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              <strong className="text-crimson text-lg">This action cannot be undone!</strong>
              <br />
              <br />
              This will permanently delete:
              <ul className="list-disc list-inside mt-3 space-y-2 text-sm">
                <li>All {raceCount} race records</li>
                <li>Model state and weights</li>
                <li>Odds bucket statistics</li>
                <li>Betting history</li>
                <li>Session data</li>
              </ul>
              <br />
              The system will be reset to its initial state as if freshly installed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFullReset} 
              className="bg-crimson hover:bg-crimson/90 text-destructive-foreground font-black"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
