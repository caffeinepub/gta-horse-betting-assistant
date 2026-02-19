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
      <Toaster />
    </ThemeProvider>
  );
}
