import { BettingWorkflow } from './components/BettingWorkflow';
import { Layout } from './components/Layout';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Layout>
        <BettingWorkflow />
      </Layout>
      <Toaster 
        position="top-right"
        toastOptions={{
          classNames: {
            toast: 'bg-card border-border/50 shadow-premium',
            title: 'text-foreground font-bold',
            description: 'text-muted-foreground',
            actionButton: 'bg-primary text-primary-foreground',
            cancelButton: 'bg-muted text-muted-foreground',
          },
        }}
      />
    </ThemeProvider>
  );
}
