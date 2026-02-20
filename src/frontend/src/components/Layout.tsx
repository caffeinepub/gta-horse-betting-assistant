import { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { SiX } from 'react-icons/si';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const currentYear = new Date().getFullYear();
  const appIdentifier = encodeURIComponent(
    typeof window !== 'undefined' ? window.location.hostname : 'gta-horse-betting'
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-primary/30 bg-gradient-to-b from-card to-background shadow-premium backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative bg-gradient-to-br from-primary to-accent p-3 rounded-xl shadow-glow">
                <Sparkles className="h-7 w-7 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                GTA Horse Betting
              </h1>
              <p className="text-sm text-muted-foreground font-medium tracking-wide">
                Value Detection • Learning System • ROI Tracking
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12">
        {children}
      </main>

      <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm py-8 mt-auto">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            © {currentYear} • Built with{' '}
            <span className="text-crimson">❤️</span>
            {' '}using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${appIdentifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors font-semibold"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
